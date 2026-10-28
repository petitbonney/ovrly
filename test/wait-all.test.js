// Wait For All under load: concurrent firings that each feed every link keep their own data; links fed by different
// triggers still meet across firings.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { fire } = await import('../server/engine.js')
const node = (id, type, config = {}) => ({ id, data: { type, config } })
const edge = (source, target) => ({ id: `${source}-${target}`, source, target })
// A branch that takes a random time, so the firings' arrivals interleave.
const slow = (key) => node(key, 'code', { code: `await new Promise((r) => setTimeout(r, Math.random() * 20)); return { ${key}: data.n }` })

test('concurrent firings through a diamond each continue with their own data', async () => {
  const workflow = { id: 'diamond', nodes: [node('t', 'manual'), slow('a'), slow('b'), node('w', 'wait-all')],
    edges: [edge('t', 'a'), edge('t', 'b'), edge('a', 'w'), edge('b', 'w')] }
  const runs = await Promise.all(Array.from({ length: 200 }, (_, n) => fire(workflow, 'manual', { n })))
  runs.forEach(([run], n) => assert.deepEqual(run.outputs.w, { a: n, b: n }))
})

test('links fed by different triggers meet across firings', async () => {
  const workflow = { id: 'two', nodes: [node('t1', 'manual', { data: '{}' }), node('t2', 'manual', { data: '{}' }), node('w', 'wait-all')],
    edges: [edge('t1', 'w'), edge('t2', 'w')] }
  const first = fire(workflow, 'manual', { a: 1 }, {}, 't1')
  const [[second]] = await Promise.all([fire(workflow, 'manual', { b: 2 }, {}, 't2'), first])
  assert.deepEqual(second.outputs.w, { a: 1, b: 2 })
})
