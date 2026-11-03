// Import/export: workflows and widgets travel as one JSON bundle { widgets: [...], workflows: [...] }.
import { get, json } from './api.js'

// A workflow bundled with the widget instances its widget nodes point to.
function bundle(workflow, widgets) {
  const refs = workflow.nodes.map((n) => n.data.config?.widget).filter(Boolean)
  return { widgets: widgets.filter((w) => refs.includes(w.id)), workflows: [workflow] }
}

export async function exportWorkflow(id) {
  return bundle(await get(`/api/workflows/${id}`), await get('/api/widgets'))
}

const fileName = (name) => name.replace(/[^\w-]+/g, '-') || 'workflow'

function save(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function download(bundle, name) {
  save(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }), `${fileName(name)}.json`)
}

// Every workflow as its own bundle in one zip, so each file imports alone. Same names get -2, -3 (case aside, for
// the file systems that ignore it).
export async function exportAll() {
  const [workflows, widgets] = await Promise.all([get('/api/workflows'), get('/api/widgets')])
  if (!workflows.length) throw new Error('No workflows to export yet')
  const taken = new Set()
  const files = workflows.map((w) => {
    let name = fileName(w.name ?? '')
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${fileName(w.name ?? '')}-${n}`
    taken.add(name.toLowerCase())
    return { name: `${name}.json`, text: JSON.stringify(bundle(w, widgets), null, 2) }
  })
  save(await zip(files), `ovrly-workflows-${new Date().toISOString().slice(0, 10)}.zip`)
}

// CRC-32, the zip checksum, from a table built once.
const CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = (bytes) => {
  let c = ~0
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

// Little-endian bytes of [size, value] pairs (2 or 4 bytes each), for the zip headers.
function le(...fields) {
  const view = new DataView(new ArrayBuffer(fields.reduce((n, [size]) => n + size, 0)))
  let at = 0
  for (const [size, value] of fields) {
    size === 2 ? view.setUint16(at, value, true) : view.setUint32(at, value, true)
    at += size
  }
  return new Uint8Array(view.buffer)
}

// A zip of { name, text } files, deflated by the browser (CompressionStream), so no zip package is needed.
async function zip(files) {
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const encode = (text) => new TextEncoder().encode(text)
  const entries = [], central = []
  let offset = 0
  for (const { name, text } of files) {
    const raw = encode(text), path = encode(name)
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    // Version 2.0, UTF-8 names (0x800), deflated (8), then the fields both headers share.
    const fields = [[2, 20], [2, 0x800], [2, 8], [2, time], [2, date], [4, crc32(raw)], [4, data.length], [4, raw.length], [2, path.length], [2, 0]]
    entries.push(le([4, 0x04034b50], ...fields), path, data)
    central.push(le([4, 0x02014b50], [2, 20], ...fields, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]), path)
    offset += 30 + path.length + data.length
  }
  const size = central.reduce((n, part) => n + part.length, 0)
  const end = le([4, 0x06054b50], [2, 0], [2, 0], [2, files.length], [2, files.length], [4, size], [4, offset], [2, 0])
  return new Blob([...entries, ...central, end], { type: 'application/zip' })
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
  // Portal In nodes get fresh ids, and the bundle's Portal Out nodes sending through them follow: a template imported
  // twice sends through its own.
  const portals = Object.fromEntries(workflows.flatMap((w) => w.nodes).filter((n) => n.data.type === 'portal-in').map((n) => [n.id, crypto.randomUUID()]))
  const node = (id) => portals[id] ?? id
  for (const { id, ...workflow } of workflows) {
    const nodes = withWidgetIds(workflow.nodes, ids).map((n) => ({ ...n, id: node(n.id),
      ...(n.data.type === 'portal-out' && portals[n.data.config?.target] && { data: { ...n.data, config: { ...n.data.config, target: portals[n.data.config.target] } } }) }))
    const edges = workflow.edges?.map((e) => ({ ...e, source: node(e.source), target: node(e.target) }))
    const saved = await fetch('/api/workflows', json('POST', { ...workflow, nodes, edges })).then((r) => r.json())
    created.unshift({ kind: 'workflows', id: saved.id })
  }
  return created[0]
}

// Picks .json files and zips of them (as exportAll makes) and imports them all as one bundle: a widget several
// workflows share comes in once, and Portals between them keep working.
export function importFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.json,.zip,application/json,application/zip'
    input.onchange = () => importFiles([...input.files]).then(resolve, reject)
    input.click()
  })
}

async function importFiles(picked) {
  const files = (await Promise.all(picked.map(async (f) => /\.zip$/i.test(f.name) ? unzip(f) : [{ name: f.name, text: await f.text() }]))).flat()
  const widgets = new Map(), workflows = []
  for (const { name, text } of files) {
    let bundle
    try { bundle = JSON.parse(text) } catch { throw new Error(`${name} isn't valid JSON`) }
    for (const w of bundle.widgets ?? []) widgets.set(w.id, w)
    workflows.push(...(bundle.workflows ?? []))
  }
  if (!workflows.length && !widgets.size) throw new Error('No workflows found')
  return importBundle({ widgets: [...widgets.values()], workflows })
}

// The .json files of a zip as { name, text }, stored or deflated (what zip tools write), but not the hidden ones
// (macOS adds __MACOSX/._name.json copies).
async function unzip(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const u16 = (at) => view.getUint16(at, true), u32 = (at) => view.getUint32(at, true)
  let end = bytes.length - 22 // the end record, found from the back: a zip comment may follow it
  while (end >= 0 && u32(end) !== 0x06054b50) end--
  if (end < 0) throw new Error(`${blob.name} isn't a zip file`)
  const files = []
  for (let i = 0, at = u32(end + 16); i < u16(end + 10); i++) {
    const method = u16(at + 10), size = u32(at + 20), local = u32(at + 42)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + u16(at + 28)))
    at += 46 + u16(at + 28) + u16(at + 30) + u16(at + 32)
    if (!/\.json$/i.test(name) || /(^|\/)(__MACOSX|\.)/.test(name)) continue
    if (method !== 0 && method !== 8) throw new Error(`${name}: unsupported compression in the zip`)
    const start = local + 30 + u16(local + 26) + u16(local + 28)
    const data = new Blob([bytes.subarray(start, start + size)])
    files.push({ name, text: await new Response(method ? data.stream().pipeThrough(new DecompressionStream('deflate-raw')) : data).text() })
  }
  return files
}
