// Saving and deleting workflows, with what follows: a workflow switched off stops what it runs, Merge Widgets pages
// follow their canvas, Stream Deck keys their Control Pad buttons, and the widget instances no workflow uses anymore
// are deleted.
import * as store from './store.js'
import { cancel } from './engine.js'
import * as merge from './merge.js'
import * as streamdeck from './integrations/streamdeck.js'
import * as widgets from './widgets.js'
import { httpError } from './errors.js'

// A widget instance lives as long as its workflow node: once a workflow is saved or deleted, the widgets it referred to
// and no workflow uses anymore are deleted. Tolerant of a broken file on disk, so it can't block every save.
const widgetRefs = (workflow) => workflow?.nodes?.filter?.((n) => n?.data?.type === 'widget').map((n) => n.data.config?.widget) ?? []
async function dropUnusedWidgets(refs) {
  const used = new Set((await store.list('workflows')).flatMap(widgetRefs))
  for (const id of refs.filter((id) => id && !used.has(id))) await widgets.remove(id)
}

// The engine walks nodes[].data and edges[] on every event: a workflow without them would fail each time.
const isObject = (v) => v !== null && typeof v === 'object'
const valid = (w) => Array.isArray(w.nodes) && w.nodes.every((n) => isObject(n) && isObject(n.data))
  && Array.isArray(w.edges) && w.edges.every(isObject)

// Saves and deletes of one workflow run one at a time: each reads the saved workflow before writing it, so an autosave
// in flight can't write back `enabled` after a switch-off (or the emergency stop).
const queues = {} // workflow id -> its last save or delete
const queued = (id, task) => (queues[id] = (queues[id] ?? Promise.resolve()).catch(() => {}).then(task))

// Creates a workflow (no id), or updates one: merged over the saved one, so the editor's autosave keeps fields it
// doesn't send (e.g. enabled).
export function save(workflow) {
  return workflow.id ? queued(workflow.id, () => write(workflow)) : write(workflow)
}

async function write(workflow) {
  const old = workflow.id ? await store.get('workflows', workflow.id) : null
  const merged = { ...old, ...workflow }
  if (!valid(merged)) throw httpError(400, 'A workflow needs a list of nodes (each with data) and a list of edges')
  const item = await store.save('workflows', merged)
  if (workflow.enabled === false) cancel(item.id) // switched off: stop what is running
  merge.push(item) // widgets moved on a Merge Widgets canvas
  streamdeck.push() // buttons changed, or the workflow switched on or off (faded keys)
  await dropUnusedWidgets(widgetRefs(old))
  return item
}

export function remove(id) {
  return queued(id, async () => {
    const old = await store.get('workflows', id)
    await store.remove('workflows', id)
    streamdeck.push()
    await dropUnusedWidgets(widgetRefs(old))
  })
}
