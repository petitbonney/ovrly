// Basic view: which graphs are one line (chainOf), and the links that rebuild a line after a Basic edit (relink).
import test from 'node:test'
import assert from 'node:assert/strict'
import { chainOf, relink } from '../ui/src/chain.js'

const outputs = { 'if-else': 'true', cooldown: 'pass' }
const opts = { isTrigger: (n) => n.type === 'follow' || n.type === 'manual', firstOutput: (n) => outputs[n.type] ?? null }
const node = (id, type = 'log') => ({ id, type })
const link = (source, target, sourceHandle = null) => ({ id: `${source}-${target}`, source, sourceHandle, target })
const ids = (list) => list?.map((n) => n.id) ?? null

test('empty, a lone trigger, and a trigger with steps are lines', () => {
  assert.deepEqual(ids(chainOf([], [], opts)), [])
  assert.deepEqual(ids(chainOf([node('t', 'follow')], [], opts)), ['t'])
  const nodes = [node('b'), node('t', 'follow'), node('a')]
  assert.deepEqual(ids(chainOf(nodes, [link('a', 'b'), link('t', 'a')], opts)), ['t', 'a', 'b'])
})

test('steps without a trigger are a line', () => {
  assert.deepEqual(ids(chainOf([node('a'), node('b')], [link('a', 'b')], opts)), ['a', 'b'])
})

test('two triggers, a fork, a merge or a loose node are not', () => {
  assert.equal(chainOf([node('t', 'follow'), node('u', 'manual'), node('a')], [link('t', 'a'), link('u', 'a')], opts), null)
  assert.equal(chainOf([node('t', 'follow'), node('u', 'manual')], [link('u', 't')], opts), null) // a trigger after the head
  assert.equal(chainOf([node('t', 'follow'), node('a'), node('b')], [link('t', 'a'), link('t', 'b')], opts), null)
  assert.equal(chainOf([node('t', 'follow'), node('a'), node('b')], [link('t', 'a')], opts), null)
})

test('a loop is not a line', () => {
  assert.equal(chainOf([node('a'), node('b')], [link('a', 'b'), link('b', 'a')], opts), null)
})

test('a node with several outputs continues from its first only', () => {
  const nodes = [node('t', 'follow'), node('c', 'cooldown'), node('a')]
  assert.deepEqual(ids(chainOf(nodes, [link('t', 'c'), link('c', 'a', 'pass')], opts)), ['t', 'c', 'a'])
  assert.equal(chainOf(nodes, [link('t', 'c'), link('c', 'a', 'blocked')], opts), null)
  const ifs = [node('t', 'follow'), node('i', 'if-else'), node('a')]
  assert.deepEqual(ids(chainOf(ifs, [link('t', 'i'), link('i', 'a', 'true')], opts)), ['t', 'i', 'a'])
  assert.equal(chainOf(ifs, [link('t', 'i'), link('i', 'a', 'false')], opts), null)
})

test('relink keeps the links in place and adds the missing ones from the first output', () => {
  const kept = link('t', 'c')
  const edges = relink([node('t', 'follow'), node('c', 'cooldown'), node('a')], [kept, link('a', 'x')], opts.firstOutput)
  assert.equal(edges.length, 2)
  assert.equal(edges[0], kept)
  assert.deepEqual({ ...edges[1], id: undefined }, { id: undefined, source: 'c', sourceHandle: 'pass', target: 'a', targetHandle: null })
})

test('relink of a list of one or none has no links', () => {
  assert.deepEqual(relink([node('a')], [link('a', 'b')], opts.firstOutput), [])
  assert.deepEqual(relink([], [], opts.firstOutput), [])
})
