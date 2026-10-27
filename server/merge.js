// Merge Widgets pages (/m/<workflow>/<node>, merge.html): the widget nodes linked into that node, each in an iframe
// placed on its canvas. Their stream carries the placement (null while there is no such node), again whenever the
// workflow is saved, and the merged widgets' own snapshots, as SSE events named by widget id, so the page holds one
// connection instead of one per widget (browsers allow only 6 per server).
import * as widgets from './widgets.js'

// The placement: { items: [{ id, x, y, w, h }] }, bottom layer first; null if the workflow has no such node.
// A widget not placed yet gets the same default box as in the editor (Merge.jsx): half the canvas, cascading.
export function view(workflow, id) {
  const node = workflow?.nodes.find((n) => n.id === id && n.data.type === 'merge')
  if (!node) return null
  const { layout = {}, order = [] } = node.data.config
  const ids = [...new Set(workflow.edges.filter((e) => e.target === id).map((e) => workflow.nodes.find((n) => n.id === e.source))
    .filter((n) => n?.data.type === 'widget').map((n) => n.data.config.widget))]
  // Items from the bottom layer up (the page stacks them in that order): see the node's order setting.
  const top = [...ids.filter((w) => !order.includes(w)).reverse(), ...order.filter((w) => ids.includes(w))]
  const items = ids.map((w, i) => ({ id: w, ...(layout[w] ?? { x: 0.03 * i, y: 0.03 * i, w: 0.5, h: 0.5 }) }))
  return { items: items.sort((a, b) => top.indexOf(b.id) - top.indexOf(a.id)) }
}

const clients = {} // workflow id -> Set of { node, res, widgets: widget id -> detach }
async function send(workflow, client) {
  const placement = view(workflow, client.node)
  client.res.write(`data: ${JSON.stringify(placement)}\n\n`)
  const ids = placement?.items.map((i) => i.id) ?? []
  for (const [id, detach] of client.widgets) if (!ids.includes(id)) detach(), client.widgets.delete(id)
  for (const id of ids.filter((id) => !client.widgets.has(id))) {
    const widget = await widgets.get(id).catch(() => null)
    if (widget) client.widgets.set(id, await widgets.attach(id, { write: (msg) => client.res.write(`event: ${id}\n${msg}`) }))
  }
}

// Sends the workflow's new placements to its pages, after it was saved (widgets moved on a Merge Widgets canvas).
export function push(workflow) {
  for (const client of clients[workflow.id] ?? []) send(workflow, client).catch((err) => console.error('[merge]', err))
}

// Express handler for GET /m/:workflow/:node/events, with the workflow (null if there is none).
export function stream(workflow, req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  const client = { node: req.params.node, res, widgets: new Map() }
  const set = (clients[req.params.workflow] ??= new Set()).add(client)
  req.on('close', () => {
    set.delete(client)
    for (const detach of client.widgets.values()) detach()
  })
  return send(workflow, client)
}
