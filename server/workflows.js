// Saving and deleting workflows, with what follows: a workflow switched off stops what it runs, Merge Widgets pages
// follow their canvas, Stream Deck keys their Control Pad buttons, Word Filter nodes get their lists, and the widget
// instances no workflow uses anymore are deleted. Old Widget Action nodes become links into widget ports.
import * as store from './store.js'
import { cancel } from './engine.js'
import * as merge from './merge.js'
import * as streamdeck from './integrations/streamdeck.js'
import * as wordLists from './integrations/word-lists.js'
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

// Widget Action nodes (from before widget nodes had action ports) become links into their widget node's port: each
// link into one goes on to the port of the action it picked (none: the widget's stop action), and to the other nodes
// it was linked to (they got the data as it came in). Its inputs become the widget's for that action, unless another
// one's are already (two Widget Actions running one action with different inputs: the first one's are kept). One
// picking the main action (onSignal) links into the main port, without its inputs. Returns the workflow itself when it
// has none.
async function unwrapWidgetActions(workflow) {
  if (!workflow.nodes.some((n) => n.data.type === 'widget-action')) return workflow
  let { nodes, edges } = workflow
  for (const a of nodes.filter((n) => n.data.type === 'widget-action')) {
    const into = edges.filter((e) => e.target === a.id)
    const out = edges.filter((e) => e.source === a.id)
    const w = nodes.find((n) => n.data.type === 'widget' && out.some((e) => e.target === n.id))
    const widget = w && await widgets.get(w.data.config?.widget)
    const def = widgets.types[widget?.type]
    const action = a.data.config?.action || def?.onStop || 'stop'
    const port = action === def?.onSignal ? null : action
    const input = a.data.config?.input ?? {}
    if (port && Object.keys(input).length) {
      const saved = widget.state.input[port]
      if (!saved) await widgets.save({ ...widget, state: { ...widget.state, input: { ...widget.state.input, [port]: input } } })
      else if (JSON.stringify(saved) !== JSON.stringify(input)) console.warn(`[workflows] "${workflow.name}": ${widget.state.name}'s ${port} keeps the inputs of its first Widget Action`)
    }
    const links = into.flatMap((x) => out.map((o) => ({ id: `${x.id}>${o.id}`, source: x.source, sourceHandle: x.sourceHandle ?? null, target: o.target,
      targetHandle: o.target === w?.id ? port : o.targetHandle ?? null })))
    const same = (e, l) => ['source', 'sourceHandle', 'target', 'targetHandle'].every((k) => (e[k] ?? null) === l[k])
    edges = edges.filter((e) => e.source !== a.id && e.target !== a.id)
    edges.push(...links.filter((l) => !edges.some((e) => same(e, l))))
    nodes = nodes.filter((n) => n !== a).map((n) => (n !== w || !port || n.data.config?.ports?.includes(port) ? n
      : { ...n, data: { ...n.data, config: { ...n.data.config, ports: [...(n.data.config?.ports ?? []), port] } } }))
  }
  return { ...workflow, nodes, edges }
}

// Rewrites the saved workflows that still have Widget Action nodes, once at startup (server/index.js).
export async function migrate() {
  for (const workflow of [...await store.list('workflows')]) {
    if (!valid(workflow)) continue
    const next = await unwrapWidgetActions(workflow)
    if (next !== workflow) await store.save('workflows', next)
  }
}

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
  const item = await store.save('workflows', await unwrapWidgetActions(merged)) // e.g. an old workflow imported
  if (workflow.enabled === false) cancel(item.id) // switched off: stop what is running
  merge.push(item) // widgets moved on a Merge Widgets canvas
  streamdeck.push() // buttons changed, or the workflow switched on or off (faded keys)
  wordLists.prefetch(item) // lists just picked are downloaded before the first run
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
