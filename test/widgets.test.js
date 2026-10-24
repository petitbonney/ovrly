// Widget instances: bindings, merging results, the saved state, the in-memory runtime and the file writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { counter } from './fixture-type.js'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { types, normalize, merge, create, get, read, update, play, remove, changes } = await import('../server/widgets.js')
types.counter = normalize(counter)

const text = (id) => fs.readFile(`data/widgets/${id}.json`, 'utf8')
const file = async (id) => JSON.parse(await text(id))
const add = (n) => ({ action: 'add', input: { n } })
let id // the instance created with { step: 2 }

test('normalize fills bindings', () => {
  const def = normalize({ actions: { start: {} } })
  assert.equal(def.onSignal, 'start')
  assert.equal(def.onStart, 'start')
  assert.equal(def.onStop, 'stop')
  assert.equal(def.onCancel, 'cancel')
  assert.equal(typeof def.actions.stop.run, 'function')
  assert.equal(typeof def.actions.cancel.run, 'function')
  const bound = normalize({ onSignal: 'push', onStop: 'end', actions: { start: {}, push: {} } })
  assert.ok(bound.actions.end.run)
  assert.equal(bound.actions.stop, undefined)
})

test('merge detects no-ops', () => {
  const cur = { state: { a: 1 }, runtime: { b: 2 } }
  assert.equal(merge(cur), null)
  assert.equal(merge(cur, { state: cur.state }), null)
  const r = { b: 3 }
  assert.deepEqual(merge(cur, { runtime: r }), { state: cur.state, runtime: r })
})

test('create saves only id, type, state', async () => {
  ;({ id } = await create('counter', { step: 2 }))
  assert.deepEqual(await file(id), { id, type: 'counter', state: { step: 2, total: 0, name: 'Counter', input: {} } })
})

test('get fills missing keys, null for unknown types', async () => {
  await fs.writeFile('data/widgets/old.json', JSON.stringify({ id: 'old', type: 'counter', state: { step: 3 } }))
  await fs.writeFile('data/widgets/gone.json', JSON.stringify({ id: 'gone', type: 'nope', state: {} }))
  assert.equal((await get('old')).state.total, 0)
  assert.equal(await get('gone'), null)
})

test('state changes are saved, runtime ones are not', async () => {
  await update(id, add('5'))
  assert.equal((await file(id)).state.total, 5)
  const before = await text(id)
  await update(id, { action: 'onStart' })
  assert.equal((await read(id)).runtime.shown, 2)
  assert.equal(await text(id), before)
  assert.equal('runtime' in (await file(id)), false)
})

test('a no-op does nothing', async () => {
  assert.equal(await (await update(id, { action: 'noop' })).done, false)
})

test('changes fires for state only', async () => {
  const seen = []
  const listen = (widget) => seen.push(widget.id)
  changes.on('state', listen)
  await update(id, add('1'))
  await update(id, { action: 'start' })
  changes.off('state', listen)
  assert.deepEqual(seen, [id])
})

test('two quick changes both land', async () => {
  const { total } = (await file(id)).state
  await Promise.all([update(id, add('1')), update(id, add('1'))])
  assert.equal((await file(id)).state.total, total + 2)
})

test('state survives a reload, runtime resets', async () => {
  const { total } = (await read(id)).state
  const again = await import('../server/widgets.js?reload')
  again.types.counter = again.normalize(counter)
  const { state, runtime } = await again.read(id)
  assert.equal(state.total, total)
  assert.deepEqual(runtime, { shown: 0, firing: false })
})

test('remove during play stops the run', async () => {
  const p = play(id, 'hold', null, {}, new AbortController().signal)
  await remove(id)
  assert.equal(await p, null)
  assert.equal(await get(id), null)
  await assert.rejects(text(id), { code: 'ENOENT' })
})

test('remove after a queued write leaves no file', async () => {
  const { id } = await create('counter')
  const pending = update(id, add('1'))
  await remove(id)
  await Promise.allSettled([pending])
  await assert.rejects(text(id), { code: 'ENOENT' })
})

test('remove while a write is in flight leaves no file', async () => {
  const { id } = await create('counter')
  const pending = update(id, add('1'))
  await new Promise(setImmediate) // the update has run: its write is queued or under way
  await remove(id)
  await Promise.allSettled([pending])
  await assert.rejects(text(id), { code: 'ENOENT' })
})
