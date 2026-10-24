// Widget instances, one per widget node: loads widget types, keeps each instance's state (saved in
// ./data/widgets/<id>.json) and runtime (in memory), runs their actions, and pushes them to /w/:id pages over SSE.
// Each action is recorded as a `widget` event, and its end (with the output) as `widget-done` (GET /api/events).
import fs from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import bus, { record } from './bus.js'
import * as store from './store.js'
import { fill, value } from './template.js'

// Load every widget type from ../widgets/<type>/widget.js, keyed by type. Each action is { description, inputs, only,
// run({ state, runtime, input }) → { state?, runtime? } }: inputs says what it asks for, as node fields ({ option: {
// vars: true, hint }, user: { vars: true, default: '{{user}}' } }), and only when it applies, as a setting's only (e.g.
// { mode: 'chat' }). An input of type: 'var' names a data key (e.g. items) and gets its raw value (a list, an object…)
// instead of text. Four bindings name actions: onStart enters firing, onStop and onCancel end it (see end()), and
// onSignal is what a signal entering the widget node runs.
const dir = new URL('../widgets/', import.meta.url)
const builtIn = {
  stop: { description: 'Ends what is playing, as finished: the workflow that started it goes on.', run: () => {} },
  cancel: { description: 'Cuts what is playing: the workflow that started it stops there.', run: () => {} },
}
const roles = ['onSignal', 'onStart', 'onStop', 'onCancel']

// Fills in a type's bindings and defaults. The actions bound to onStop and onCancel extend the built-in ones (which
// only end firing) with their own run or description, or are those built-ins when the type has no such action.
export function normalize(def) {
  const { onStart = 'start', onSignal = onStart, onStop = 'stop', onCancel = 'cancel' } = def
  const actions = { ...def.actions, [onStop]: { ...builtIn.stop, ...def.actions[onStop] }, [onCancel]: { ...builtIn.cancel, ...def.actions[onCancel] } }
  return { ...def, onSignal, onStart, onStop, onCancel, state: def.state ?? {}, runtime: def.runtime ?? {}, actions }
}

// Types are kept in the library's order: most used first (unlisted ones last).
const order = ['alerts', 'voting', 'sound', 'image', 'video', 'lottery', 'twitch-plays']
const rank = (name) => (order.includes(name) ? order.indexOf(name) : order.length)
export const types = {}
const folders = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => rank(a.name) - rank(b.name))
for (const entry of folders) {
  const def = (await import(new URL(`${entry.name}/widget.js`, dir))).default
  types[def.type] = normalize(def)
}

// An action's or handler's { state?, runtime? } over the current { state, runtime }: each part it returns replaces
// that part. null when nothing changed.
export function merge(current, result) {
  const { state = current.state, runtime = current.runtime } = result ?? {}
  return state === current.state && runtime === current.runtime ? null : { state, runtime }
}

// A cached widget stays the same object while it lives, so an action running on it can tell if it was removed since.
const cache = {} // widget id -> { id, type, state }
const runtimes = {} // widget id -> runtime, in memory only: it resets when the server restarts
const removed = new Set() // ids removed while the server runs: a late load can't bring them back
const writes = {} // widget id -> its last file write
const clients = {} // widget id -> Set of open SSE responses
const waiting = new Map() // run id -> resolve, until a page reports that action finished
const playing = {} // widget id -> Map of run id -> settle, for the actions still playing on it (one, unless it queues)
let runs = 0

// Emits 'state' with the widget after an action or a bus handler changed its state, once its file is written.
export const changes = new EventEmitter()

const pages = (widget) => clients[widget.id]?.size ?? 0 // pages showing this widget now

// The widget with its type's defaults under its own state (e.g. a key a newer type declares); null for unknown types.
function filled({ id, type, state }) {
  const def = types[type]
  return def ? { id, type, state: { ...structuredClone(def.state), name: def.label, input: {}, ...state } } : null
}

// Writes the widget's file as it is in the cache, once the writes before it are done (or deletes it, once removed).
function persist(id) {
  const write = () => (cache[id] ? store.save('widgets', cache[id]) : store.remove('widgets', id))
  return (writes[id] = (writes[id] ?? Promise.resolve()).catch(() => {}).then(write))
}

// What actions, hooks and pages get: { state, runtime }, runtime with the type's defaults under it, and firing
// (whether runs still play on it).
function snapshot(widget) {
  const runtime = { ...structuredClone(types[widget.type].runtime), ...runtimes[widget.id], firing: playing[widget.id]?.size > 0 }
  return { state: widget.state, runtime }
}

// Puts a merged { state, runtime } in place, unless the widget was removed meanwhile. A changed state is saved.
async function commit(widget, next) {
  if (cache[widget.id] !== widget) return
  const { firing, ...runtime } = next.runtime // firing is worked out when read
  runtimes[widget.id] = runtime
  if (next.state === widget.state) return
  widget.state = next.state
  await persist(widget.id)
  changes.emit('state', widget)
}

export function create(type, state = {}) {
  return save({ id: randomUUID(), type, state })
}

// The widget, loaded from its file on first use; null if there's none, or its type isn't loaded.
export async function get(id) {
  if (!cache[id]) {
    const file = await store.get('widgets', id)
    if (file && !cache[id] && !removed.has(id)) cache[id] = filled(file)
  }
  return cache[id] ?? null
}

export async function read(id) {
  const widget = await get(id)
  return widget && snapshot(widget)
}

// Creates or replaces a widget (the editor saves its settings): written, and shown on its pages at once.
export async function save({ id, type, state }) {
  const widget = filled({ id, type, state })
  if (!widget) throw new Error(`Unknown widget type: ${type}`)
  removed.delete(id)
  cache[id] = Object.assign(cache[id] ?? {}, widget)
  await persist(id)
  push(cache[id])
  return cache[id]
}

// Deletes a widget (its node was deleted): the runs still playing on it stop there, as cancelled.
export async function remove(id) {
  settleAll(id, false)
  removed.add(id)
  delete cache[id]
  delete runtimes[id]
  await persist(id)
}

// Sends { state, runtime } to every page showing this widget, plus the run id when an action caused it, or end:
// 'stop' | 'cancel' when what plays ends (the page plays its outro, or cuts).
function push(widget, run, end) {
  const msg = `data: ${JSON.stringify({ ...snapshot(widget), run, end })}\n\n`
  for (const res of clients[widget.id] ?? []) res.write(msg)
}

// Applies one action (by name, or by role: onStart…) with its inputs, e.g. { action: 'vote', input: { option: '2', user:
// 'bob' } }, then pushes the new state and runtime.
// `done` resolves to true once the action has stopped: it has finished playing, or onStop ended it. If the widget type
// says how long it plays (playTime), the server waits that long itself: pages may be closed, or hidden and slowed down
// by the browser. Otherwise it waits for a page to report the end: right away if no page is open, after 60s if none
// answers. `done` resolves to false if it was cancelled, or replaced: an action arriving while another still plays on
// the same widget replaces it (that run stops there) and plays instead, unless the type queues them (queues(action,
// snap), e.g. alerts shown one after another, or votes while a vote is open): then both play. A type's over(snap) says
// when what plays is over before its time (e.g. a vote closed on Twitch): those runs stop there, as finished. An action
// that returns nothing new did nothing (e.g. an invalid vote): it replaces nothing and its own run stops.
// playTime(action, snap) may depend on the new state and runtime. onStop and onCancel end what plays instead (end()).
// An action may be async (e.g. it starts a Twitch poll); if it throws, nothing changes and update rejects.
export async function update(id, request) {
  const widget = await get(id)
  if (!widget) throw new Error(`Widget not found: ${id}`)
  return apply(widget, request)
}

async function apply(widget, { action, input = {} }) {
  const def = types[widget.type]
  const name = roles.includes(action) ? def[action] : action
  const act = def.actions[name]
  if (!act) throw new Error(`${def.label}: unknown action "${action}"`)
  input = Object.fromEntries(Object.keys(act.inputs ?? {}).map((key) => [key, typeof input[key] === 'object' ? input[key] : String(input[key] ?? '').trim()]))
  if (name === def.onStop || name === def.onCancel) return { ...await end(widget, name === def.onStop ? 'stop' : 'cancel', input), done: Promise.resolve(true) }
  const snap = snapshot(widget)
  // A sync action is put in place in the same tick, so two quick ones build on each other.
  let result = act.run({ ...snap, input })
  if (result instanceof Promise) result = await result
  const next = merge(snap, result)
  if (!next || cache[widget.id] !== widget) return { ...snap, done: Promise.resolve(false) } // did nothing, or removed
  if (!def.queues?.(name, snap)) settleAll(widget.id, false)
  const saved = commit(widget, next)
  if (def.over?.(next)) settleAll(widget.id, true)
  const run = ++runs
  const ms = def.playTime?.(name, next)
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
  await saved
  push(widget, run)
  record('sse', 'widget', { widget: widget.state.name, action: name, ...(Object.keys(input).length && { input }), pages: pages(widget) })
  done.then((played) => record('sse', played ? 'widget-done' : 'widget-cancelled', { widget: widget.state.name, action: name, ...(played && output(widget)) }))
  return { ...snapshot(widget), done, run }
}

// Stops ("stop") or cancels ("cancel") what plays on a widget, after the action its type binds to onStop or onCancel
// (e.g. Voting closes the vote). Stopped runs go on once the outro has played (stopTime(snap), ms); cancelled ones stop
// there. Pages play the outro or cut, and the runtime is marked ended, so a page opened (or reloaded) afterwards
// doesn't replay it. With a run id, only if that run still plays (a workflow cancels its own actions, not newer ones).
// Should the type's own action fail (e.g. a Twitch call), what plays still ends, then end rejects.
async function end(widget, how, input = {}, run) {
  if (run && !playing[widget.id]?.has(run)) return snapshot(widget)
  const def = types[widget.type]
  const action = how === 'stop' ? def.onStop : def.onCancel
  const snap = snapshot(widget)
  let next = snap, error
  try {
    next = merge(snap, await def.actions[action].run({ ...snap, input })) ?? snap
  } catch (err) {
    error = err
  }
  // Out of `playing` at once: an action arriving during the outro can't replace them anymore.
  const settles = [...(playing[widget.id]?.values() ?? [])]
  playing[widget.id]?.clear()
  const ms = how === 'stop' ? def.stopTime?.(next) ?? 0 : 0
  for (const settle of settles) setTimeout(settle, ms, how === 'stop')
  await commit(widget, { ...next, runtime: { ...next.runtime, ended: true } })
  push(widget, undefined, how)
  record('sse', 'widget', { widget: widget.state.name, action, pages: pages(widget) })
  if (error) throw error
  return snapshot(widget)
}

// Ends every run playing on a widget at once: played (true), they go on; otherwise they stop there.
function settleAll(id, played) {
  for (const settle of [...(playing[id]?.values() ?? [])]) settle(played)
}

// What the widget type's output(snap) gives back to the workflow now, e.g. { winner: 'Red' }.
function output(widget) {
  return types[widget.type].output?.(snapshot(widget)) ?? {}
}

// Runs an action (by name, or by role: onSignal…) from a workflow on a widget, with its inputs (templates, or the
// field's default) filled from the data; input null takes the ones saved in its state.input. Resolves once it has
// stopped, with the data plus the widget's output then (e.g. { winner }), or null if it was cancelled or replaced (the
// run stops there). Cancelling the workflow (signal) cancels the widget, with its onCancel action, if its run still plays.
export async function play(id, action, input, data, signal) {
  const widget = id && await get(id)
  if (!widget) throw new Error(id ? `Widget not found: ${id}` : 'No widget picked')
  const def = types[widget.type]
  const name = roles.includes(action) ? def[action] : action
  input ??= widget.state.input[name]
  const fields = Object.entries(def.actions[name]?.inputs ?? {})
  const filled = Object.fromEntries(fields.map(([key, f]) => {
    let t = String(input?.[key] ?? f.default ?? '').trim()
    if (f.type === 'var') t = t.replace(/^\{\{(.*)\}\}$/s, '$1').trim() // "{{items}}" is items too
    return [key, f.type !== 'var' ? fill(t, data) : t ? value(`{{${t}}}`, data) : '']
  }))
  const { done, run } = await apply(widget, { action: name, input: filled })
  const cancel = () => end(widget, 'cancel', {}, run).catch((err) => record('sse', 'widget-error', { widget: widget.state.name, action: def.onCancel, error: err.message }))
  if (run) signal.addEventListener('abort', cancel, { once: true })
  return (await done) ? { ...data, ...output(widget) } : null
}

// Bus events a widget type follows: its on: { event: (snap, data) => ({ state?, runtime? }) } handlers run for each of
// its widgets, e.g. a Twitch poll's progress updating the Voting widget that started it. Returning nothing skips it.
for (const def of Object.values(types)) {
  for (const [event, handle] of Object.entries(def.on ?? {})) {
    bus.on(event, async (data) => {
      for (const { id } of (await store.list('widgets')).filter((w) => w.type === def.type)) {
        const widget = await get(id)
        if (!widget) continue
        const snap = snapshot(widget)
        const next = merge(snap, handle(snap, data))
        if (!next) continue
        const saved = commit(widget, next)
        if (def.over?.(next)) settleAll(id, true)
        await saved
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
export function stream(id, req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  const detach = attach(id, res)
  req.on('close', async () => (await detach)())
}

// Adds a page (anything with write(msg)) to the widget's clients and sends it the current snapshot; resolves to the
// function that removes it. A Merge Widgets stream attaches one per merged widget.
export async function attach(id, res) {
  const set = (clients[id] ??= new Set()).add(res)
  const widget = await get(id)
  if (widget) push(widget)
  return () => set.delete(res)
}
