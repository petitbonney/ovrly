// Custom nodes: files in data/nodes/ load next to the built-in ones (a broken one or a taken type is reported, not
// loaded), run with the ovrly helpers, reload once changed; a workflow reaching an unknown type fails there.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
await fs.writeFile('package.json', '{ "type": "module" }') // as in Ovrly's folder: .js files are modules
await fs.mkdir('data/nodes', { recursive: true })
const write = (file, code) => fs.writeFile(`data/nodes/${file}`, code)
await write('shout.js', `export default { type: 'shout', label: 'Shout', category: 'action', config: { text: '{{user}}!' },
  run: ({ config, data, ovrly }) => ({ ...data, shout: ovrly.fill(config.text, data).toUpperCase() }) }`)
await write('broken.js', 'export default {')
await write('log.js', `export default { type: 'log', label: 'Mine', category: 'action', run: () => ({}) }`)
const { nodes, problems, loadNodes, fire } = await import('../server/engine.js')

const node = (id, type, config = {}) => ({ id, data: { type, config } })
const flow = (type) => ({ id: type, nodes: [node('t', 'manual'), node('n', type)], edges: [{ id: 'e', source: 't', target: 'n' }] })

test('a custom node loads, in the Custom group, and runs with the helpers', async () => {
  assert.equal(nodes.shout.group, 'Custom')
  assert.equal(nodes.shout.custom, 'shout.js')
  const [run] = await fire(flow('shout'), 'manual', { user: 'ana' })
  assert.equal(run.outputs.n.shout, 'ANA!')
})

test('a broken file and a taken type are reported, the built-in kept', () => {
  assert.deepEqual(problems.map((p) => p.file), ['broken.js', 'log.js'])
  assert.match(problems[1].error, /already taken/)
  assert.equal(nodes.log.label, 'Log')
})

test('a changed or new file loads on reload', async () => {
  await write('broken.js', `export default { type: 'fixed', label: 'Fixed', category: 'logic', run: ({ data }) => data }`)
  await loadNodes()
  assert.equal(nodes.fixed.label, 'Fixed')
  assert.deepEqual(problems.map((p) => p.file), ['log.js'])
})

test('a workflow reaching an unknown type fails there', async () => {
  const [run] = await fire(flow('gone'), 'manual', {})
  assert.match(run.error.message, /Unknown node type "gone"/)
})
