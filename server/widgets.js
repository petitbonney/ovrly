// Widget runtime: loads widget types, keeps each widget's live state, and pushes it to /w/:id pages over SSE.
// Each action is recorded as a `widget` event, and its end (with the output) as `widget-done` (GET /api/events).
import fs from 'node:fs/promises'
import { record } from './bus.js'

// Load every widget type from ../widgets/<type>/widget.js, keyed by type.
const dir = new URL('../widgets/', import.meta.url)
export const types = {}
for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const def = (await import(new URL(`${entry.name}/widget.js`, dir))).default
  types[def.type] = def
}

// Live state lives in memory only: it resets when the server restarts.
const states = {} // widget id -> state
const clients = {} // widget id -> Set of open SSE responses
const waiting = new Map() // run id -> resolve, until a page reports that action finished
const playing = {} // widget id -> cancels the action still playing on it
let runs = 0

function snapshot(widget) {
  const def = types[widget.type]
  return { config: { ...def.config, ...widget.config }, state: states[widget.id] ?? structuredClone(def.state) }
}

// Sends the current { config, state } to every page showing this widget, plus the run id when an action caused it.
export function push(widget, run) {
  const msg = `data: ${JSON.stringify({ ...snapshot(widget), run })}\n\n`
  for (const res of clients[widget.id] ?? []) res.write(msg)
}

// Applies one action, e.g. { action: 'vote', value: '2', user: 'bob' }, then pushes the new state.
// `done` resolves to true once the action has finished playing. If the widget type says how long it plays (playTime),
// the server waits that long itself: pages may be closed, or hidden and slowed down by the browser. Otherwise it waits
// for a page to report the end: right away if no page is open, after 60s if none answers.
// Cancel and restart: an action arriving while another still plays on the same widget cancels it (its `done` resolves
// to false, so that run stops) and plays instead.
// `output` is what the widget type's output(state, config) gives back to the workflow, e.g. { winner: 'Red' }.
export function update(widget, { action, value = '', user = '' }) {
  const def = types[widget.type]
  const fn = def.actions[action]
  if (!fn) throw new Error(`${def.label}: unknown action "${action}"`)
  playing[widget.id]?.()
  const { config, state } = snapshot(widget)
  states[widget.id] = fn(state, { value: String(value).trim(), user }, config)
  const run = ++runs
  const ms = def.playTime?.(action, config)
  const done = new Promise((resolve) => {
    const cancel = (playing[widget.id] = () => {
      waiting.delete(run)
      resolve(false)
    })
    const end = () => {
      if (playing[widget.id] === cancel) delete playing[widget.id]
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
  return { state: states[widget.id], done, output }
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
