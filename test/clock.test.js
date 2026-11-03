// Countdown and Timer: times typed or from chat, the clock's formats, a countdown's run following "add" (retime), and
// both started, paused (Stop) and reset (Cancel).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { types, create, read, update } = await import('../server/widgets.js')
const { clock, duration, nextTime } = await import('../widgets/clock.js')

// The clock and timers, so a countdown's time passes at once.
const clock0 = (t) => t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2026, 10, 1, 18, 0).getTime() })
// Whether a promise has settled by the time pending callbacks have run.
const settled = async (promise) => {
  let done = false
  promise.then(() => (done = true))
  await new Promise(setImmediate)
  return done
}

test('durations and times of day, as typed or sent from chat', () => {
  assert.deepEqual(['90', '90s', '5m', '1h30m', '1h 30m 10s', '2 mins', '1:30', '1:02:03'].map(duration),
    [90_000, 90_000, 300_000, 5_400_000, 5_410_000, 120_000, 90_000, 3_723_000])
  assert.ok(['', 'soon', '5x', '1:2:3:4'].map(duration).every(Number.isNaN))
  const now = new Date(2026, 10, 1, 18, 0).getTime()
  const at = (text) => (nextTime(text, now) - now) / 60_000
  assert.deepEqual(['20:00', '20h30', '8pm', '8:30pm', '17:00', '18:00'].map(at), [120, 150, 120, 150, 23 * 60, 24 * 60])
  assert.ok(['25:00', '13pm', 'noon'].map((t) => nextTime(t, now)).every(Number.isNaN))
})

test('the clock: auto shows hours only when there are some; a countdown rounds up', () => {
  assert.deepEqual([clock(299_500), clock(299_500, 'auto', Math.ceil), clock(3_723_000), clock(3_723_000, 'mm:ss'), clock(63_000, 'hh:mm:ss')],
    ['4:59', '5:00', '1:02:03', '62:03', '00:01:03'])
})

test('countdown: before its start, it shows what its Start is set to; the start run ends at 0, later for added time', async (t) => {
  clock0(t)
  const { id } = await create('countdown', { input: { start: { duration: '1m' } } })
  assert.equal(types.countdown.output(await read(id)).countdownLeft, '1:00')
  const { done } = await update(id, { action: 'start', input: { mode: 'for', duration: '1m' } })
  await update(id, { action: 'add', input: { time: '+30s' } })
  t.mock.timers.tick(60_000)
  assert.equal(await settled(done), false)
  await update(id, { action: 'add', input: { time: '-10s' } })
  assert.equal(types.countdown.output(await read(id)).countdownLeft, '0:20')
  t.mock.timers.tick(20_000)
  assert.equal(await done, true)
  assert.equal(types.countdown.output(await read(id)).countdownLeft, '0:00')
})

test('countdown: start only from before its start or paused: counting or over, it does nothing until reset', async (t) => {
  clock0(t)
  const { id } = await create('countdown')
  const { state } = await update(id, { action: 'start', input: { mode: 'until', time: '20:00' } })
  assert.equal(state.end - Date.now(), 2 * 3600_000)
  assert.equal(await (await update(id, { action: 'start', input: { duration: '5:00' } })).done, false)
  await update(id, { action: 'add', input: { time: '-3h' } }) // all of it: over
  assert.equal(await (await update(id, { action: 'start', input: { duration: '5:00' } })).done, false)
  await update(id, { action: 'reset' })
  assert.equal(types.countdown.output(await read(id)).countdownLeft, '5:00') // Start's default
  await assert.rejects(update(id, { action: 'start', input: { mode: 'for', duration: 'soon' } }), /isn't a duration/)
  await assert.rejects(update(id, { action: 'add', input: { time: '+lots' } }), /isn't a duration/)
  assert.equal(await (await update(id, { action: 'add', input: { time: '30s' } })).done, false) // nothing to add to
})

test('countdown: pause (Stop) holds it and the workflow goes on; start resumes; reset (Cancel) stops the workflow', async (t) => {
  clock0(t)
  const { id } = await create('countdown')
  const first = await update(id, { action: 'start', input: { duration: '1m' } })
  t.mock.timers.tick(15_000)
  await update(id, { action: 'onStop' })
  t.mock.timers.tick(0)
  assert.equal(await first.done, true)
  assert.deepEqual([(await read(id)).state.end, (await read(id)).state.left], [0, 45_000])
  const second = await update(id, { action: 'start', input: { duration: '1h' } })
  t.mock.timers.tick(5_000)
  assert.equal(types.countdown.output(await read(id)).countdownLeft, '0:40')
  await update(id, { action: 'onCancel' })
  t.mock.timers.tick(0)
  assert.equal(await second.done, false)
  assert.deepEqual([(await read(id)).state.end, (await read(id)).state.left], [0, 0])
})

test('timer: start from 0 or paused only, pause (Stop) holds it, reset (Cancel) stops it at 0', async (t) => {
  clock0(t)
  const { id } = await create('timer')
  const elapsed = async () => types.timer.output(await read(id))
  assert.equal(await (await update(id, { action: 'start' })).done, true)
  t.mock.timers.tick(65_000)
  await update(id, { action: 'onStop' })
  t.mock.timers.tick(10_000)
  assert.deepEqual(await elapsed(), { timerElapsed: '1:05', timerSeconds: 65 })
  await update(id, { action: 'start' })
  t.mock.timers.tick(5_000)
  assert.equal(await (await update(id, { action: 'start' })).done, false) // counting already: nothing
  assert.deepEqual(await elapsed(), { timerElapsed: '1:10', timerSeconds: 70 })
  await update(id, { action: 'onCancel' })
  t.mock.timers.tick(3_000)
  assert.equal((await elapsed()).timerSeconds, 0)
  await update(id, { action: 'start' })
  t.mock.timers.tick(3_000)
  assert.equal((await elapsed()).timerSeconds, 3)
})
