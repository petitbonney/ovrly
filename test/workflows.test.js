// Saving and deleting workflows: what a workflow needs, autosave merged over the saved one, saves of one workflow in
// order, a switch-off cancelling its firings, the widget instances no workflow uses anymore deleted, and old Widget
// Action nodes turned into links into widget ports.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { save, remove, migrate } = await import('../server/workflows.js')
const store = await import('../server/store.js')
const widgets = await import('../server/widgets.js')
const { fire } = await import('../server/engine.js')

const widgetNode = (id, widget) => ({ id, data: { type: 'widget', config: { widget } } })
const label = async () => (await widgets.create('label')).id
const kept = (id) => fs.access(`data/widgets/${id}.json`).then(() => true, () => false)

test('a workflow needs a list of nodes, each with data, and a list of edges', async () => {
  await assert.rejects(save({ name: 'none' }), { status: 400 })
  await assert.rejects(save({ nodes: [{ id: 'n' }], edges: [] }), { status: 400 })
  await assert.rejects(save({ nodes: [], edges: [null] }), { status: 400 })
})

test('a save is merged over the saved workflow, so autosave keeps what it does not send', async () => {
  const { id } = await save({ name: 'a', nodes: [], edges: [], enabled: false })
  await save({ id, name: 'b', nodes: [], edges: [] })
  assert.deepEqual(await store.get('workflows', id), { id, name: 'b', nodes: [], edges: [], enabled: false })
})

test('saves of one workflow apply in order, each over the one before', async () => {
  const { id } = await save({ name: '0', nodes: [], edges: [], enabled: false })
  await Promise.all([save({ id, name: '1' }), save({ id, enabled: true }), save({ id, name: '2' })])
  const { name, enabled } = await store.get('workflows', id)
  assert.deepEqual({ name, enabled }, { name: '2', enabled: true })
})

test('switching a workflow off cancels what it runs', async () => {
  const workflow = await save({ name: 'slow', nodes: [{ id: 't', data: { type: 'manual', config: {} } }, { id: 'd', data: { type: 'delay', config: { seconds: 10 } } }],
    edges: [{ id: 'e', source: 't', target: 'd' }] })
  const firing = fire(workflow, 'manual', {})
  await new Promise(setImmediate) // the firing waits at the delay
  await save({ id: workflow.id, enabled: false })
  const [run] = await firing
  assert.equal(run.record.status, 'stopped')
})

test('widgets no workflow uses anymore are deleted, on save and on delete', async () => {
  const [mine, theirs, shared] = [await label(), await label(), await label()]
  const one = await save({ name: 'one', nodes: [widgetNode('a', mine), widgetNode('b', shared)], edges: [] })
  const two = await save({ name: 'two', nodes: [widgetNode('a', theirs), widgetNode('b', shared)], edges: [] })
  await save({ id: one.id, nodes: [widgetNode('b', shared)] }) // its node deleted in the editor
  assert.equal(await kept(mine), false)
  assert.equal(await widgets.get(mine), null)
  await remove(two.id)
  assert.deepEqual([await kept(theirs), await kept(shared)], [false, true]) // shared: still used by "one"
  await remove(one.id)
  assert.equal(await kept(shared), false)
})

const step = (id, type, config = {}) => ({ id, data: { type, config } })
const link = (id, source, target) => ({ id, source, target })
// A link as the migration leaves it, without its id.
const shape = ({ id, ...e }) => e

test('a Widget Action becomes a link into its widget node\'s port, its inputs the widget\'s', async (t) => {
  t.mock.method(console, 'warn', () => {}) // the second add's inputs, not kept
  const countdown = (await widgets.create('countdown')).id
  const { nodes, edges } = await save({ name: 'subathon', nodes: [
    step('sub', 'subscription'), step('cheer', 'cheer'), widgetNode('w', countdown), step('log', 'log'),
    step('subTime', 'widget-action', { action: 'add', input: { time: '+5m' } }),
    step('bitsTime', 'widget-action', { action: 'add', input: { time: '+1m' } }), // one add's inputs only: the first's
    step('pause', 'widget-action', { action: '', input: {} }), // none picked: the stop action, "pause" on a countdown
    step('go', 'widget-action', { action: 'start', input: { duration: '1h' } }), // the main action: the main port
  ], edges: [link('e1', 'sub', 'subTime'), link('e2', 'cheer', 'bitsTime'), link('e3', 'sub', 'pause'), link('e4', 'cheer', 'go'),
    link('e5', 'subTime', 'w'), link('e6', 'bitsTime', 'w'), link('e7', 'pause', 'w'), link('e8', 'go', 'w'), link('e9', 'subTime', 'log')] })
  assert.deepEqual(nodes.map((n) => n.id), ['sub', 'cheer', 'w', 'log'])
  assert.deepEqual(nodes[2].data.config.ports, ['add', 'pause'])
  assert.deepEqual(edges.map(shape), [
    { source: 'sub', sourceHandle: null, target: 'w', targetHandle: 'add' },
    { source: 'sub', sourceHandle: null, target: 'log', targetHandle: null }, // got the data as it came in
    { source: 'cheer', sourceHandle: null, target: 'w', targetHandle: 'add' },
    { source: 'sub', sourceHandle: null, target: 'w', targetHandle: 'pause' },
    { source: 'cheer', sourceHandle: null, target: 'w', targetHandle: null },
  ])
  assert.deepEqual((await widgets.read(countdown)).state.input, { add: { time: '+5m' } })
})

test('a Widget Action linked to no widget goes, its other links kept', async () => {
  const { nodes, edges } = await save({ name: 'loose', nodes: [step('t', 'manual'), step('a', 'widget-action'), step('log', 'log')],
    edges: [link('e1', 't', 'a'), link('e2', 'a', 'log')] })
  assert.deepEqual(nodes.map((n) => n.id), ['t', 'log'])
  assert.deepEqual(edges.map(shape), [{ source: 't', sourceHandle: null, target: 'log', targetHandle: null }])
})

test('saved workflows with Widget Action nodes are rewritten at startup', async () => {
  const label = (await widgets.create('label')).id
  await store.save('workflows', { id: 'old', name: 'old', nodes: [step('t', 'manual'), step('a', 'widget-action'), widgetNode('w', label)],
    edges: [link('e1', 't', 'a'), link('e2', 'a', 'w')] })
  await migrate()
  const { nodes, edges } = await store.get('workflows', 'old')
  assert.deepEqual(nodes.map((n) => n.id), ['t', 'w'])
  assert.deepEqual(edges.map(shape), [{ source: 't', sourceHandle: null, target: 'w', targetHandle: 'stop' }])
})

test('a broken workflow file on disk does not stop the others from cleaning up', async (t) => {
  t.mock.method(console, 'error', () => {}) // the store logs the file it skips
  await fs.writeFile('data/workflows/odd.json', '{ "nodes": "not a list" }')
  await fs.writeFile('data/workflows/junk.json', '{')
  const widget = await label()
  const { id } = await save({ name: 'w', nodes: [widgetNode('a', widget)], edges: [] })
  await save({ id, nodes: [] })
  assert.equal(await kept(widget), false)
})
