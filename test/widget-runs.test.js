// What plays on a widget: how long a run lasts (playTime, a page's report, stopTime), what ends it (a newer action,
// over(), Stop, Cancel, the workflow cancelled) and what a failing action leaves.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { types, normalize, create, read, update, play, attach, finish } = await import('../server/widgets.js')

// Plays a text for the ms given ('' waits for a page to report the end); "queue" plays alongside, and "close" ends it
// early, without replacing it (like Voting's "win").
const show = ({ runtime, input }) => ({ runtime: { ...runtime, text: input.text, ms: input.ms === '' ? undefined : Number(input.ms) } })
types.show = normalize({
  type: 'show',
  label: 'Show',
  playTime: (action, { runtime }) => runtime.ms,
  stopTime: () => 30,
  queues: (action) => action !== 'start',
  over: ({ runtime }) => runtime.over === true,
  output: ({ runtime }) => ({ said: runtime.text }),
  actions: {
    start: { inputs: { text: {}, ms: {} }, run: show },
    queue: { inputs: { text: {}, ms: {} }, run: show },
    close: { run: ({ runtime }) => ({ runtime: { ...runtime, over: true, ms: 0 } }) },
    fail: { run: () => { throw Object.assign(new Error('Twitch says no'), { status: 409 }) } },
    refuse: { run: () => { throw new Error('Show: needs a text') } },
  },
})
const start = (text, ms = '') => ({ action: 'start', input: { text, ms: String(ms) } })
const widget = async () => (await create('show')).id
const firing = async (id) => (await read(id)).runtime.firing
// Whether a promise has settled by the time pending callbacks have run.
const settled = async (promise) => {
  let done = false
  promise.then(() => (done = true))
  await new Promise(setImmediate)
  return done
}

test('an action plays for its playTime', async () => {
  const id = await widget()
  const { done } = await update(id, start('a', 20))
  assert.equal(await firing(id), true)
  assert.equal(await done, true)
  assert.equal(await firing(id), false)
})

test('a newer action replaces the one playing, unless the type queues it', async () => {
  const id = await widget()
  const first = await update(id, start('a', 200))
  const second = await update(id, start('b', 20))
  assert.equal(await first.done, false)
  assert.equal(await second.done, true)
  const queued = [await update(id, { ...start('c', 20), action: 'queue' }), await update(id, { ...start('d', 20), action: 'queue' })]
  assert.deepEqual(await Promise.all(queued.map((q) => q.done)), [true, true])
})

test('without a playTime, it waits for a page to report the end, 60s at most; with no page, it ends at once', { timeout: 1000 }, async (t) => {
  const id = await widget()
  assert.equal(await (await update(id, start('a'))).done, true)
  await attach(id, { write: () => {} })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const reported = await update(id, start('b'))
  assert.equal(await settled(reported.done), false)
  finish(reported.run)
  assert.equal(await reported.done, true)
  const silent = await update(id, start('c'))
  t.mock.timers.tick(60_000)
  assert.equal(await silent.done, true)
})

test('Stop ends what plays as finished once the outro has played, Cancel cuts it', async () => {
  const id = await widget()
  const stopped = await update(id, start('a', 200))
  const { runtime } = await update(id, { action: 'onStop' })
  assert.equal(runtime.ended, true) // a page opened now doesn't replay it
  assert.equal(await settled(stopped.done), false) // stopTime: 30ms
  assert.equal(await stopped.done, true)
  const cut = await update(id, start('b', 200))
  assert.equal((await update(id, { action: 'onCancel' })).runtime.ended, true)
  assert.equal(await cut.done, false)
})

test('over() ends what plays as finished', async () => {
  const id = await widget()
  const run = await update(id, start('a', 200))
  await update(id, { action: 'close' })
  assert.equal(await settled(run.done), true) // now, not after its 200ms
  assert.equal(await run.done, true)
})

test('an action that throws changes nothing, and rejects with its status, else 400', async () => {
  const id = await widget()
  const run = await update(id, start('a', 50))
  await assert.rejects(update(id, { action: 'fail' }), { status: 409, message: 'Twitch says no' })
  await assert.rejects(update(id, { action: 'refuse' }), { status: 400 })
  await assert.rejects(update(id, { action: 'nope' }), { status: 400, message: /unknown action "nope"/ })
  await assert.rejects(update('missing', start('a')), { status: 404 })
  assert.equal((await read(id)).runtime.text, 'a')
  assert.equal(await firing(id), true)
  assert.equal(await run.done, true)
})

test('play fills the inputs from the data, and resolves with the data and the output once played', async () => {
  const id = await widget()
  const out = await play(id, 'onSignal', { text: '{{user}}', ms: '0' }, { user: 'ana' }, new AbortController().signal)
  assert.deepEqual(out, { user: 'ana', said: 'ana' })
})

test('cancelling the workflow cancels its own run, not a newer one', async () => {
  const id = await widget()
  const own = new AbortController()
  const cancelled = play(id, 'start', { text: 'a', ms: '200' }, {}, own.signal)
  await new Promise(setImmediate) // play is waiting for the run to end
  own.abort()
  assert.equal(await cancelled, null)
  assert.equal((await read(id)).runtime.ended, true)

  const old = new AbortController()
  const replaced = play(id, 'start', { text: 'b', ms: '200' }, {}, old.signal)
  await new Promise(setImmediate)
  const newer = await update(id, start('c', 20))
  assert.equal(await replaced, null)
  old.abort()
  assert.equal(await newer.done, true)
  assert.equal((await read(id)).runtime.text, 'c')
})
