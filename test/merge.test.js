// Merge Widgets placement: the widgets linked into the node, their boxes (a default cascade until placed) and their
// layers (the order setting lists them top first; those not ordered yet go on top, the last linked highest).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { view } = await import('../server/merge.js')

const widget = (id) => ({ id, data: { type: 'widget', config: { widget: `w-${id}` } } })
const merge = (config = {}) => ({ id: 'm', data: { type: 'merge', config } })
const into = (...sources) => sources.map((source) => ({ id: `${source}-m`, source, target: 'm' }))
const workflow = (config, edges = into('a', 'b')) =>
  ({ nodes: [widget('a'), widget('b'), widget('c'), widget('d'), { id: 'log', data: { type: 'log', config: {} } }, merge(config)], edges })
const ids = (placement) => placement.items.map((i) => i.id)

test('no placement without a Merge Widgets node of that id', () => {
  assert.equal(view(null, 'm'), null)
  assert.equal(view(workflow(), 'nope'), null)
  assert.equal(view(workflow(), 'a'), null) // a widget node, not a merge
})

test('the widgets linked into the node are placed, once each', () => {
  const edges = [...into('a', 'log', 'b'), { id: 'a-again', source: 'a', target: 'm' }, { id: 'c-log', source: 'c', target: 'log' }]
  assert.deepEqual(ids(view(workflow({}, edges), 'm')).sort(), ['w-a', 'w-b'])
})

test('a widget keeps its box once placed, the others cascade from the corner at half the canvas', () => {
  const box = { x: 0.5, y: 0.25, w: 0.4, h: 0.3 }
  const { items } = view(workflow({ layout: { 'w-a': box } }, into('a', 'b', 'c')), 'm')
  const byId = Object.fromEntries(items.map(({ id, ...rest }) => [id, rest]))
  assert.deepEqual(byId, { 'w-a': box, 'w-b': { x: 0.03, y: 0.03, w: 0.5, h: 0.5 }, 'w-c': { x: 0.06, y: 0.06, w: 0.5, h: 0.5 } })
})

test('layers come bottom first: ordered widgets as the order lists them, the others above, the last linked highest', () => {
  assert.deepEqual(ids(view(workflow({}, into('a', 'b', 'c')), 'm')), ['w-a', 'w-b', 'w-c'])
  const order = ['gone', 'w-c', 'w-a'] // top first; "gone" is no longer linked
  assert.deepEqual(ids(view(workflow({ order }, into('a', 'b', 'c', 'd')), 'm')), ['w-a', 'w-c', 'w-b', 'w-d'])
})
