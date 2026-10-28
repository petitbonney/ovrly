// Custom nodes and widgets: files in data/custom/ load next to the built-in ones (a broken one or a taken type is
// reported, not loaded; a node's helper files in a subfolder are skipped), run with the ovrly helpers and reload once
// changed. A workflow reaching an unknown node type fails there; a widget whose type is gone keeps its file. New
// widget's starter loads and plays.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
await fs.writeFile('package.json', '{ "type": "module" }') // as in Ovrly's folder: .js files are modules
const write = async (file, code) => {
  await fs.mkdir(path.dirname(`data/custom/${file}`), { recursive: true })
  await fs.writeFile(`data/custom/${file}`, code)
}
await write('nodes/lib/upper.js', 'export const upper = (s) => s.toUpperCase()') // a helper: imported, not a node
await write('nodes/shout.js', `import { upper } from './lib/upper.js'
export default { type: 'shout', label: 'Shout', category: 'action', config: { text: '{{user}}!' },
  run: ({ config, data, ovrly }) => ({ ...data, shout: upper(ovrly.fill(config.text, data)) }) }`)
await write('nodes/broken.js', 'export default {')
await write('nodes/log.js', `export default { type: 'log', label: 'Mine', category: 'action', run: () => ({}) }`)
const big = (label) => `export default { type: 'big', label: '${label}', state: { size: 1 },
  actions: { start: { inputs: { text: {} }, run: ({ input, ovrly }) => ({ runtime: { text: ovrly.fill('{{t}}', { t: input.text }) } }) } } }`
await write('widgets/big/widget.js', big('Big'))
await write('widgets/big/index.html', '<!doctype html>')
await write('widgets/wrong/widget.js', big('Wrong'))
await write('widgets/wrong/index.html', '<!doctype html>')
const { nodes, problems, loadNodes, fire } = await import('../server/engine.js')
const widgets = await import('../server/widgets.js')
const custom = await import('../server/custom.js')

const node = (id, type, config = {}) => ({ id, data: { type, config } })
const flow = (type) => ({ id: type, nodes: [node('t', 'manual'), node('n', type)], edges: [{ id: 'e', source: 't', target: 'n' }] })

test('a custom node loads, in the Custom group, and runs with the helpers and its own files', async () => {
  assert.equal(nodes.shout.group, 'Custom')
  assert.equal(nodes.shout.custom, 'shout.js')
  const [run] = await fire(flow('shout'), 'manual', { user: 'ana' })
  assert.equal(run.outputs.n.shout, 'ANA!')
})

test('a broken file and a taken type are reported, the built-in kept', () => {
  assert.deepEqual(problems.map((p) => p.name), ['broken.js', 'log.js'])
  assert.match(problems[1].error, /already taken/)
  assert.equal(nodes.log.label, 'Log')
})

test('a changed or new node file loads on reload', async () => {
  await write('nodes/broken.js', `export default { type: 'fixed', label: 'Fixed', category: 'logic', run: ({ data }) => data }`)
  await loadNodes()
  assert.equal(nodes.fixed.label, 'Fixed')
  assert.deepEqual(problems.map((p) => p.name), ['log.js'])
})

test('a workflow reaching an unknown node type fails there', async () => {
  const [run] = await fire(flow('gone'), 'manual', {})
  assert.match(run.error.message, /Unknown node type "gone"/)
})

test('a custom widget loads with its page, and its actions get the helpers', async () => {
  assert.equal(widgets.types.big.page, path.resolve('data/custom/widgets/big/index.html'))
  assert.match(widgets.problems.find((p) => p.name === 'wrong').error, /folder's name/)
  const { id } = await widgets.create('big')
  const { runtime } = await widgets.update(id, { action: 'start', input: { text: 'hi' } })
  assert.equal(runtime.text, 'hi')
})

test('a reload tells its pages, and a widget whose type is gone keeps its file', async () => {
  const { id } = await widgets.create('big')
  const sent = []
  await widgets.attach(id, { write: (msg) => sent.push(msg) })
  await write('widgets/big/widget.js', big('Bigger'))
  await widgets.loadTypes()
  assert.equal(widgets.types.big.label, 'Bigger')
  assert.ok(sent.some((msg) => msg.includes('"reload":true')))
  await fs.rm('data/custom/widgets/big', { recursive: true })
  await widgets.loadTypes()
  assert.equal(await widgets.get(id), null)
  assert.equal(JSON.parse(await fs.readFile(`data/widgets/${id}.json`, 'utf8')).type, 'big')
})

test('a new widget from the starter loads and plays', async () => {
  const type = await custom.scaffold('Hello There')
  await widgets.loadTypes()
  assert.equal(widgets.types[type].label, 'Hello There')
  const { id } = await widgets.create(type)
  const { runtime } = await widgets.update(id, { action: 'start', input: { text: 'yo' } })
  assert.equal(runtime.text, 'yo')
})

test('an imported widget folder replaces the old one', async () => {
  await custom.file('imp', 'widget.js', Buffer.from(big('Imp').replace("type: 'big'", "type: 'imp'")), true)
  await custom.file('imp', 'index.html', Buffer.from('<!doctype html>'))
  await assert.rejects(custom.file('imp', '../x.js', Buffer.from('')), /Can't import/)
  await custom.done('imp')
  await widgets.loadTypes()
  assert.equal(widgets.types.imp.label, 'Imp')
})
