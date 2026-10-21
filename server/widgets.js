// Widget runtime: loads widget types, keeps each widget's live state, and pushes it to /w/:id pages over SSE.
// Each action is recorded as a `widget` event, and its end (with the output) as `widget-done` (GET /api/events).
import fs from 'node:fs/promises'
import bus, { record } from './bus.js'
import * as store from './store.js'
import { fill } from './template.js'

// Load every widget type from ../widgets/<type>/widget.js, keyed by type. Every type also gets "show" and "hide" (fade
// the whole overlay in or out; a type's own "show", like the alert's, also shows the overlay) and "cancel" (see cancel()).
// `main` is the action a widget node runs (the type's first one if it doesn't say). `inputs` says what each action asks
// for, as node fields: { vote: { option: { vars: true, hint }, user: { vars: true, default: '{{user}}' } } }.
const dir = new URL('../widgets/', import.meta.url)
export const types = {}
for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const def = (await import(new URL(`${entry.name}/widget.js`, dir))).default
  const keep = (state) => state
  // fades: the built-in actions this type doesn't define itself, which play for the 400ms fade.
  const fades = ['show', 'hide'].filter((a) => !def.actions[a])
  types[def.type] = { ...def, main: def.main ?? Object.keys(def.actions)[0], fades, actions: { ...def.actions, show: def.actions.show ?? keep, hide: def.actions.hide ?? keep, cancel: keep } }
}

// Live state lives in memory only: it resets when the server restarts.
const states = {} // widget id -> state
const hidden = {} // widget id -> true while hidden by "hide"
const clients = {} // widget id -> Set of open SSE responses
const waiting = new Map() // run id -> resolve, until a page reports that action finished
const playing = {} // widget id -> Map of run id -> stop, for the actions still playing on it (one, unless it queues)
let runs = 0

const pages = (widget) => clients[widget.id]?.size ?? 0 // pages showing this widget now

function snapshot(widget) {
  const def = types[widget.type]
  return { config: { ...def.config, ...widget.config }, state: states[widget.id] ?? structuredClone(def.state), hidden: !!hidden[widget.id] }
}

// Sends the current { config, state } to every page showing this widget, plus the run id when an action caused it,
// or cancel: true to make pages stop their animation.
export function push(widget, run, cancel) {
  const msg = `data: ${JSON.stringify({ ...snapshot(widget), run, cancel })}\n\n`
  for (const res of clients[widget.id] ?? []) res.write(msg)
}

// Applies one action with its inputs, e.g. { action: 'vote', input: { option: '2', user: 'bob' } }, then pushes the new state.
// `done` resolves to true once the action has finished playing. If the widget type says how long it plays (playTime),
// the server waits that long itself: pages may be closed, or hidden and slowed down by the browser. Otherwise it waits
// for a page to report the end: right away if no page is open, after 60s if none answers.
// Cancel and restart: an action arriving while another still plays on the same widget cancels it (its `done` resolves
// to false, so that run stops) and plays instead, unless the type queues them (queues(config, action), e.g. alerts
// shown one after another, or votes while a vote is open): then both play. A type's over(state, config) says when
// what plays is over before its time (e.g. a vote closed early): those runs end there, as played. An action that returns the same state did nothing (e.g. an invalid
// vote): it cancels nothing and its own run stops. playTime(action, config, state) may depend on the new state. The "cancel" action only stops what is playing; the built-in "show"
// and "hide" only fade the overlay.
// An action may be async (e.g. it starts a Twitch poll); if it throws, the state is kept and update rejects.
export async function update(widget, { action, input = {} }) {
  const def = types[widget.type]
  const fn = def.actions[action]
  if (!fn) throw new Error(`${def.label}: unknown action "${action}"`)
  if (action === 'cancel') return { state: cancel(widget), done: Promise.resolve(true) }
  // Built-in show/hide only fade the overlay: they don't interrupt what is playing on it.
  if (def.fades.includes(action)) {
    hidden[widget.id] = action === 'hide'
    push(widget)
    record('sse', 'widget', { widget: widget.name, action, pages: pages(widget) })
    return { state: states[widget.id], done: new Promise((resolve) => setTimeout(resolve, 400, true)) }
  }
  const { config, state } = snapshot(widget)
  input = Object.fromEntries(Object.keys(def.inputs?.[action] ?? {}).map((key) => [key, String(input[key] ?? '').trim()]))
  const next = await fn(state, input, config)
  if (next === state) return { state, done: Promise.resolve(false) } // did nothing: nothing is cancelled
  if (!def.queues?.(config, action)) stopAll(widget)
  states[widget.id] = next
  if (def.over?.(next, config)) endAll(widget)
  if (action === 'show') hidden[widget.id] = false // a type's own "show" (e.g. an alert) shows the overlay too
  const run = ++runs
  const ms = def.playTime?.(action, config, next)
  const done = new Promise((resolve) => {
    if (ms === 0) return resolve(true) // over at once: never "playing", so the next action can't cancel it
    // settle(true): it has finished playing; settle(false): it was cancelled.
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

// What the widget type's output(state, config) gives back to the workflow now, e.g. { winner: 'Red' }.
function output(widget) {
  const { config, state } = snapshot(widget)
  return types[widget.type].output?.(state, config) ?? {}
}

// Runs an action from a workflow on a widget instance (by id or name), its main one if none is given, with its inputs
// (templates, or the field's default) filled from the data. Resolves once it has finished playing, with the data plus the widget's output then (e.g. { winner }),
// or null if another action cancelled it (the run stops there). Cancelling the workflow (signal) cancels the action.
export async function play(ref, action, input, data, signal) {
  const widget = (await store.list('widgets')).find((w) => w.id === ref || w.name === ref)
  if (!widget) throw new Error(ref ? `Widget not found: ${ref}` : 'No widget picked')
  const def = types[widget.type]
  action ||= def.main
  const fields = Object.entries(def.inputs?.[action] ?? {})
  const filled = Object.fromEntries(fields.map(([key, f]) => [key, fill(input?.[key] ?? f.default ?? '', data)]))
  const { done, run } = await update(widget, { action, input: filled })
  signal.addEventListener('abort', () => cancel(widget, run), { once: true })
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
        if (def.over?.(next, config)) endAll(widget)
        push(widget)
      }
    })
  }
}

// Stops what is playing on a widget: its run stops waiting (`done` resolves to false) and pages stop their animation.
// With a run id, only if that action is still playing (a workflow cancels its own actions, not newer ones).
export function cancel(widget, run) {
  if (run && !playing[widget.id]?.has(run)) return states[widget.id]
  stopAll(widget)
  // Marked in the state too, so a page opened (or reloaded) afterwards doesn't replay the cancelled animation.
  states[widget.id] = { ...snapshot(widget).state, cancelled: true }
  push(widget, undefined, true)
  record('sse', 'widget', { widget: widget.name, action: 'cancel', pages: pages(widget) })
  // A type may also undo what it started: onCancel names the action that does it (Voting: "close" ends the vote).
  const undo = types[widget.type].onCancel
  if (undo) update(widget, { action: undo }).catch((err) => record('sse', 'widget-error', { widget: widget.name, action: undo, error: err.message }))
  return states[widget.id]
}

// Stops every action playing on a widget: their runs stop waiting (cancelled).
function stopAll(widget) {
  for (const settle of [...(playing[widget.id]?.values() ?? [])]) settle(false)
}

// Ends every action playing on a widget, as played: their runs go on.
function endAll(widget) {
  for (const settle of [...(playing[widget.id]?.values() ?? [])]) settle(true)
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
