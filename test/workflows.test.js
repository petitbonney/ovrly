// Saving and deleting workflows: what a workflow needs, autosave merged over the saved one, saves of one workflow in
// order, a switch-off cancelling its firings, and the widget instances no workflow uses anymore deleted.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { save, remove } = await import('../server/workflows.js')
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

test('a broken workflow file on disk does not stop the others from cleaning up', async (t) => {
  t.mock.method(console, 'error', () => {}) // the store logs the file it skips
  await fs.writeFile('data/workflows/odd.json', '{ "nodes": "not a list" }')
  await fs.writeFile('data/workflows/junk.json', '{')
  const widget = await label()
  const { id } = await save({ name: 'w', nodes: [widgetNode('a', widget)], edges: [] })
  await save({ id, nodes: [] })
  assert.equal(await kept(widget), false)
})
