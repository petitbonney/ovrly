// Import/export: workflows and widgets travel as one JSON bundle { widgets: [...], workflows: [...] }.
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const get = (path) => fetch(path).then((r) => r.json())

// Bundles one item; a workflow takes along the widgets its widget-update nodes point to (by id or name).
export async function exportItem(kind, id) {
  const item = await get(`/api/${kind}/${id}`)
  if (kind === 'widgets') return { widgets: [item], workflows: [] }
  const refs = item.nodes.map((n) => n.data.config?.widget).filter(Boolean)
  const widgets = (await get('/api/widgets')).filter((w) => refs.includes(w.id) || refs.includes(w.name))
  return { widgets, workflows: [item] }
}

export function download(bundle, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }))
  a.download = `${name.replace(/[^\w-]+/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Saves a bundle as new items (fresh ids, so nothing is overwritten) and returns the first one as { kind, id }.
// Widget references in workflows are rewritten to the new widget ids, so they can't hit a same-named widget.
export async function importBundle({ widgets = [], workflows = [] }) {
  const ids = {} // old widget id or name -> new id
  const created = []
  for (const { id, ...widget } of widgets) {
    const saved = await fetch('/api/widgets', json('POST', widget)).then((r) => r.json())
    ids[id] = ids[widget.name] = saved.id
    created.push({ kind: 'widgets', id: saved.id })
  }
  for (const { id, ...workflow } of workflows) {
    const nodes = workflow.nodes.map((n) => {
      const ref = ids[n.data.config?.widget]
      return ref ? { ...n, data: { ...n.data, config: { ...n.data.config, widget: ref } } } : n
    })
    const saved = await fetch('/api/workflows', json('POST', { ...workflow, nodes })).then((r) => r.json())
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
