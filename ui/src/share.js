// Import/export: workflows and widgets travel as one JSON bundle { widgets: [...], workflows: [...] }.
import { get, json } from './api.js'

// Bundles a workflow with the widget instances its widget nodes point to.
export async function exportWorkflow(id) {
  const item = await get(`/api/workflows/${id}`)
  const refs = item.nodes.map((n) => n.data.config?.widget).filter(Boolean)
  const widgets = (await get('/api/widgets')).filter((w) => refs.includes(w.id))
  return { widgets, workflows: [item] }
}

export function download(bundle, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }))
  a.download = `${name.replace(/[^\w-]+/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Nodes with their widget ids rewritten (ids: old id -> new id; others are kept): a widget node's widget, and a Merge
// Widgets node's placement (layout) and drawing order, both keyed by widget id.
export function withWidgetIds(nodes, ids) {
  const id = (old) => ids[old] ?? old
  return nodes.map((n) => {
    const { config } = n.data
    if (n.data.type === 'widget' && ids[config?.widget]) return { ...n, data: { ...n.data, config: { ...config, widget: id(config.widget) } } }
    if (n.data.type !== 'merge' || !config) return n
    const layout = Object.fromEntries(Object.entries(config.layout ?? {}).map(([k, v]) => [id(k), v]))
    return { ...n, data: { ...n.data, config: { ...config, layout, ...(config.order && { order: config.order.map(id) }) } } }
  })
}

// Saves a bundle as new items (fresh ids, so nothing is overwritten) and returns the first one as { kind, id }.
// Widget references in workflows are rewritten to the new widget ids.
export async function importBundle({ widgets = [], workflows = [] }) {
  const ids = {} // old widget id -> new id
  const created = []
  for (const { id, ...widget } of widgets) {
    const saved = await fetch('/api/widgets', json('POST', widget)).then((r) => r.json())
    ids[id] = saved.id
    created.push({ kind: 'widgets', id: saved.id })
  }
  for (const { id, ...workflow } of workflows) {
    const saved = await fetch('/api/workflows', json('POST', { ...workflow, nodes: withWidgetIds(workflow.nodes, ids) })).then((r) => r.json())
    created.unshift({ kind: 'workflows', id: saved.id })
  }
  return created[0]
}

// Picks a .json file and imports it.
export function importFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => input.files[0].text().then((t) => importBundle(JSON.parse(t))).then(resolve, reject)
    input.click()
  })
}
