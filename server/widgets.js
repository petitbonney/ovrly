// Widget runtime: loads widget types, keeps each widget's live state, and pushes it to /w/:id pages over SSE.
// Each action is recorded as a `widget` event, and its end (with the output) as `widget-done` (GET /api/events).
import fs from 'node:fs/promises'
import bus, { record } from './bus.js'
import * as store from './store.js'
import { fill, value } from './template.js'

// Load every widget type from ../widgets/<type>/widget.js, keyed by type. Each action is { description, inputs, only,
// run(state, input, config) → state }: inputs says what it asks for, as node fields ({ option: { vars: true, hint },
// user: { vars: true, default: '{{user}}' } }), and only when it applies, as a setting's only (e.g. { mode: 'chat' }).
// An input of type: 'var' names a data key (e.g. items) and gets its raw value (a list, an object…) instead of text.
// Every type has "start", which its widget node runs unless the type links another action to it (linked), and "stop"
// and "cancel" (see end()), which it may extend with its own run or description.
const dir = new URL('../widgets/', import.meta.url)
const keep = (state) => state
const builtIn = {
  stop: { description: 'Ends what is playing, as finished: the workflow that started it goes on.', run: keep },
  cancel: { description: 'Cuts what is playing: the workflow that started it stops there.', run: keep },
}
// Types are kept in the library's order: most used first (unlisted ones last).
const order = ['alerts', 'voting', 'sound', 'image', 'video', 'lottery', 'twitch-plays']
const rank = (name) => (order.includes(name) ? order.indexOf(name) : order.length)
export const types = {}
const folders = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => rank(a.name) - rank(b.name))
for (const entry of folders) {
  const def = (await import(new URL(`${entry.name}/widget.js`, dir))).default
  const { stop, cancel } = def.actions
  types[def.type] = { ...def, linked: def.linked ?? 'start', actions: { ...def.actions, stop: { ...builtIn.stop, ...stop }, cancel: { ...builtIn.cancel, ...cancel } } }
}

// Live state lives in memory only: it resets when the server restarts.
const states = {} // widget id -> state
const clients = {} // widget id -> Set of open SSE responses
const waiting = new Map() // run id -> resolve, until a page reports that action finished
const playing = {} // widget id -> Map of run id -> settle, for the actions still playing on it (one, unless it queues)
let runs = 0

const pages = (widget) => clients[widget.id]?.size ?? 0 // pages showing this widget now

function snapshot(widget) {
  const def = types[widget.type]
  return { config: { ...def.config, ...widget.config }, state: states[widget.id] ?? structuredClone(def.state) }
}

// Sends the current { config, state } to every page showing this widget, plus the run id when an action caused it,
// or end: 'stop' | 'cancel' when what plays ends (the page plays its outro, or cuts).
export function push(widget, run, end) {
  const msg = `data: ${JSON.stringify({ ...snapshot(widget), run, end })}\n\n`
  for (const res of clients[widget.id] ?? []) res.write(msg)
}

// Applies one action with its inputs, e.g. { action: 'vote', input: { option: '2', user: 'bob' } }, then pushes the new state.
// `done` resolves to true once the action has stopped: it has finished playing, or "stop" ended it. If the widget type
// says how long it plays (playTime), the server waits that long itself: pages may be closed, or hidden and slowed down
// by the browser. Otherwise it waits for a page to report the end: right away if no page is open, after 60s if none
// answers. `done` resolves to false if it was cancelled, or replaced: an action arriving while another still plays on
// the same widget replaces it (that run stops there) and plays instead, unless the type queues them
// (queues(config, action), e.g. alerts shown one after another, or votes while a vote is open): then both play. A
// type's over(state, config) says when what plays is over before its time (e.g. a vote closed on Twitch): those runs
// stop there, as finished. An action that returns the same state did nothing (e.g. an invalid vote): it replaces
// nothing and its own run stops. playTime(action, config, state) may depend on the new state. "stop" and "cancel"
// end what plays instead (see end()).
// An action may be async (e.g. it starts a Twitch poll); if it throws, the state is kept and update rejects.
export async function update(widget, { action, input = {} }) {
  const def = types[widget.type]
  const act = def.actions[action]
  if (!act) throw new Error(`${def.label}: unknown action "${action}"`)
  input = Object.fromEntries(Object.keys(act.inputs ?? {}).map((key) => [key, typeof input[key] === 'object' ? input[key] : String(input[key] ?? '').trim()]))
  if (action === 'stop' || action === 'cancel') return { state: await end(widget, action, input), done: Promise.resolve(true) }
  const { config, state } = snapshot(widget)
  const next = await act.run(state, input, config)
  if (next === state) return { state, done: Promise.resolve(false) } // did nothing: nothing is replaced
  if (!def.queues?.(config, action)) settleAll(widget, false)
  states[widget.id] = next
  if (def.over?.(next, config)) settleAll(widget, true)
  const run = ++runs
  const ms = def.playTime?.(action, config, next)
  const done = new Promise((resolve) => {
    if (ms === 0) return resolve(true) // over at once: never "playing", so the next action can't replace it
    // settle(true): it has stopped; settle(false): it was cancelled or replaced.
    const runs = (playing[widget.id] ??= new Map())
    const settle = (played) => {
      runs.delete(run)
      waiting.delete(run)
      resolve(played)
    }
    runs.set(run, settle)
    if (ms !== undefined) setTimeout(settle, ms, true)
    else if (pages(widget)) {
      waiting.set(run, () => settle(true))
      setTimeout(() => finish(run), 60_000)
    } else settle(true)
  })
  push(widget, run)
  record('sse', 'widget', { widget: widget.name, action, ...(Object.keys(input).length && { input }), pages: pages(widget) })
  done.then((played) => record('sse', played ? 'widget-done' : 'widget-cancelled', { widget: widget.name, action, ...(played && output(widget)) }))
  return { state: states[widget.id], done, run }
}

// Stops ("stop") or cancels ("cancel") what plays on a widget, after the type's own stop or cancel (e.g. Voting closes
// the vote). Stopped runs go on once the outro has played (stopTime(config), ms); cancelled ones stop there. Pages play
// the outro or cut, and the state is marked ended, so a page opened (or reloaded) afterwards doesn't replay it. With a
// run id, only if that run still plays (a workflow cancels its own actions, not newer ones). Should the type's own
// action fail (e.g. a Twitch call), what plays still ends, then end rejects.
async function end(widget, how, input = {}, run) {
  if (run && !playing[widget.id]?.has(run)) return states[widget.id]
  const { config, state } = snapshot(widget)
  const def = types[widget.type]
  let next = state, error
  try {
    next = await def.actions[how].run(state, input, config)
  } catch (err) {
    error = err
  }
  // Out of `playing` at once: an action arriving during the outro can't replace them anymore.
  const settles = [...(playing[widget.id]?.values() ?? [])]
  playing[widget.id]?.clear()
  const ms = how === 'stop' ? def.stopTime?.(config) ?? 0 : 0
  for (const settle of settles) setTimeout(settle, ms, how === 'stop')
  states[widget.id] = { ...next, ended: true }
  push(widget, undefined, how)
  record('sse', 'widget', { widget: widget.name, action: how, pages: pages(widget) })
  if (error) throw error
  return states[widget.id]
}

// Ends every run playing on a widget at once: played (true), they go on; otherwise they stop there.
function settleAll(widget, played) {
  for (const settle of [...(playing[widget.id]?.values() ?? [])]) settle(played)
}

// What the widget type's output(state, config) gives back to the workflow now, e.g. { winner: 'Red' }.
function output(widget) {
  const { config, state } = snapshot(widget)
  return types[widget.type].output?.(state, config) ?? {}
}

// Runs an action from a workflow on a widget instance (by id or name), the one its type links to its widget node if
// none is given, with its inputs (templates, or the field's default) filled from the data. Resolves once it has
// stopped, with the data plus the widget's output then (e.g. { winner }), or null if it was cancelled or replaced (the
// run stops there). Cancelling the workflow (signal) cancels the widget, with its "cancel" action, if its run still plays.
export async function play(ref, action, input, data, signal) {
  const widget = (await store.list('widgets')).find((w) => w.id === ref || w.name === ref)
  if (!widget) throw new Error(ref ? `Widget not found: ${ref}` : 'No widget picked')
  const def = types[widget.type]
  action ||= def.linked
  const fields = Object.entries(def.actions[action]?.inputs ?? {})
  const filled = Object.fromEntries(fields.map(([key, f]) => {
    let t = String(input?.[key] ?? f.default ?? '').trim()
    if (f.type === 'var') t = t.replace(/^\{\{(.*)\}\}$/s, '$1').trim() // "{{items}}" is items too
    return [key, f.type !== 'var' ? fill(t, data) : t ? value(`{{${t}}}`, data) : '']
  }))
  const { done, run } = await update(widget, { action, input: filled })
  const cancel = () => end(widget, 'cancel', {}, run).catch((err) => record('sse', 'widget-error', { widget: widget.name, action: 'cancel', error: err.message }))
  if (run) signal.addEventListener('abort', cancel, { once: true })
  return (await done) ? { ...data, ...output(widget) } : null
}

// Bus events a widget type follows: its on: { event: (state, data, config) => state } handlers run for each of its
// widgets, e.g. a Twitch poll's progress updating the Poll widget that started it. Returning the same state skips it.
for (const def of Object.values(types)) {
  for (const [event, handle] of Object.entries(def.on ?? {})) {
    bus.on(event, async (data) => {
      for (const widget of (await store.list('widgets')).filter((w) => w.type === def.type)) {
        const { config, state } = snapshot(widget)
        const next = handle(state, data, config)
        if (next === state) continue
        states[widget.id] = next
        if (def.over?.(next, config)) settleAll(widget, true)
        push(widget)
      }
    })
  }
}

// Called by POST /w/:id/done when a page has finished playing an action.
export function finish(run) {
  waiting.get(run)?.()
  waiting.delete(run)
}

// Express handler for GET /w/:id/events: an SSE stream of snapshots.
export function stream(widget, req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  req.on('close', attach(widget, res))
}

// Adds a page (anything with write(msg)) to the widget's clients and sends it the current snapshot; returns the
// function that removes it. A Merge Widgets stream attaches one per merged widget.
export function attach(widget, res) {
  const set = (clients[widget.id] ??= new Set()).add(res)
  push(widget)
  return () => set.delete(res)
}
