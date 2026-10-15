// Widget runtime: loads widget types, keeps each widget's live state, and pushes it to /w/:id pages over SSE.
// Each action is recorded as a `widget` event, and its end (with the output) as `widget-done` (GET /api/events).
import fs from 'node:fs/promises'
import { record } from './bus.js'

// Load every widget type from ../widgets/<type>/widget.js, keyed by type. Every type also gets "show" and "hide" (fade
// the whole overlay in or out; a type's own "show", like the alert's, also shows the overlay) and "cancel" (see cancel()).
const dir = new URL('../widgets/', import.meta.url)
export const types = {}
for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const def = (await import(new URL(`${entry.name}/widget.js`, dir))).default
  const keep = (state) => state
  // fades: the built-in actions this type doesn't define itself, which play for the 400ms fade.
  const fades = ['show', 'hide'].filter((a) => !def.actions[a])
  types[def.type] = { ...def, fades, actions: { ...def.actions, show: def.actions.show ?? keep, hide: def.actions.hide ?? keep, cancel: keep } }
}

// Live state lives in memory only: it resets when the server restarts.
const states = {} // widget id -> state
const hidden = {} // widget id -> true while hidden by "hide"
const clients = {} // widget id -> Set of open SSE responses
const waiting = new Map() // run id -> resolve, until a page reports that action finished
const playing = {} // widget id -> { run, stop } of the action still playing on it
let runs = 0

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

// Applies one action, e.g. { action: 'vote', value: '2', user: 'bob' }, then pushes the new state.
// `done` resolves to true once the action has finished playing. If the widget type says how long it plays (playTime),
// the server waits that long itself: pages may be closed, or hidden and slowed down by the browser. Otherwise it waits
// for a page to report the end: right away if no page is open, after 60s if none answers.
// Cancel and restart: an action arriving while another still plays on the same widget cancels it (its `done` resolves
// to false, so that run stops) and plays instead. The "cancel" action only stops what is playing; the built-in "show"
// and "hide" only fade the overlay.
// `output` is what the widget type's output(state, config) gives back to the workflow, e.g. { winner: 'Red' }.
export function update(widget, { action, value = '', user = '' }) {
  const def = types[widget.type]
  const fn = def.actions[action]
  if (!fn) throw new Error(`${def.label}: unknown action "${action}"`)
  if (action === 'cancel') return { state: cancel(widget), done: Promise.resolve(true), output: {} }
  // Built-in show/hide only fade the overlay: they don't interrupt what is playing on it.
  if (def.fades.includes(action)) {
    hidden[widget.id] = action === 'hide'
    push(widget)
    record('sse', 'widget', { widget: widget.name, action, pages: clients[widget.id]?.size ?? 0 })
    return { state: states[widget.id], done: new Promise((resolve) => setTimeout(resolve, 400, true)), output: {} }
  }
  playing[widget.id]?.stop()
  const { config, state } = snapshot(widget)
  states[widget.id] = fn(state, { value: String(value).trim(), user }, config)
  if (action === 'show') hidden[widget.id] = false // a type's own "show" (e.g. an alert) shows the overlay too
  const run = ++runs
  const ms = def.playTime?.(action, config)
  const done = new Promise((resolve) => {
    const mine = (playing[widget.id] = {
      run,
      stop: () => {
        waiting.delete(run)
        resolve(false)
      },
    })
    const end = () => {
      if (playing[widget.id] === mine) delete playing[widget.id]
      resolve(true)
    }
    if (ms !== undefined) setTimeout(end, ms)
    else if (clients[widget.id]?.size) {
      waiting.set(run, end)
      setTimeout(() => finish(run), 60_000)
    } else end()
  })
  push(widget, run)
  const output = def.output?.(states[widget.id], config) ?? {}
  const pages = clients[widget.id]?.size ?? 0
  record('sse', 'widget', { widget: widget.name, action, ...(value !== '' && { value }), ...(user && { user }), pages })
  done.then((played) => record('sse', played ? 'widget-done' : 'widget-cancelled', { widget: widget.name, action, ...(played && output) }))
  return { state: states[widget.id], done, output, run }
}

// Stops what is playing on a widget: its run stops waiting (`done` resolves to false) and pages stop their animation.
// With a run id, only if that action is the one still playing (a workflow cancels its own actions, not newer ones).
export function cancel(widget, run) {
  if (run && playing[widget.id]?.run !== run) return states[widget.id]
  playing[widget.id]?.stop()
  delete playing[widget.id]
  // Marked in the state too, so a page opened (or reloaded) afterwards doesn't replay the cancelled animation.
  states[widget.id] = { ...snapshot(widget).state, cancelled: true }
  push(widget, undefined, true)
  record('sse', 'widget', { widget: widget.name, action: 'cancel', pages: clients[widget.id]?.size ?? 0 })
  return states[widget.id]
}

// Called by POST /w/:id/done when a page has finished playing an action.
export function finish(run) {
  waiting.get(run)?.()
  waiting.delete(run)
}

// Express handler for GET /w/:id/events: an SSE stream of snapshots.
export function stream(widget, req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  const set = (clients[widget.id] ??= new Set()).add(res)
  req.on('close', () => set.delete(res))
  push(widget)
}
