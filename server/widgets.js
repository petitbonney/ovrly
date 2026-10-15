// Widget runtime: loads widget types, keeps each widget's live state, and pushes it to /w/:id pages over SSE.
import fs from 'node:fs/promises'

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

function snapshot(widget) {
  const def = types[widget.type]
  return { config: { ...def.config, ...widget.config }, state: states[widget.id] ?? structuredClone(def.state) }
}

// Sends the current { config, state } to every page showing this widget.
export function push(widget) {
  const msg = `data: ${JSON.stringify(snapshot(widget))}\n\n`
  for (const res of clients[widget.id] ?? []) res.write(msg)
}

// Applies one action, e.g. { action: 'vote', value: '2', user: 'bob' }, then pushes the new state.
export function update(widget, { action, value = '', user = '' }) {
  const def = types[widget.type]
  const fn = def.actions[action]
  if (!fn) throw new Error(`${def.label}: unknown action "${action}"`)
  const { config, state } = snapshot(widget)
  states[widget.id] = fn(state, { value: String(value).trim(), user }, config)
  push(widget)
  return states[widget.id]
}

// Express handler for GET /w/:id/events: an SSE stream of snapshots.
export function stream(widget, req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  const set = (clients[widget.id] ??= new Set()).add(res)
  req.on('close', () => set.delete(res))
  push(widget)
}
