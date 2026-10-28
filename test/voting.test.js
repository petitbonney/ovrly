// The Voting widget, played as a workflow plays it. Chat: start opens voting for its duration, one vote per viewer, stop
// and win close it, and the results. Twitch: a native poll or prediction (Helix calls), its EventSub results, and
// Streamer mode needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
await fs.mkdir('data/settings', { recursive: true })
await fs.writeFile('data/settings/twitch-auth.json', JSON.stringify({ id: 'twitch-auth', access: 'x', userId: '42', expiresAt: Date.now() + 3600_000 }))
const auth = await import('../server/integrations/twitch-auth.js')
const twitch = await import('../server/integrations/twitch.js')
const { default: bus } = await import('../server/bus.js')
const { types, create, read, update } = await import('../server/widgets.js')
await auth.load()

// Twitch: each Helix call is kept as { method, path, body } and answered with reply(call).
const calls = []
let reply
globalThis.fetch = async (url, { method, body }) => {
  const call = { method, path: new URL(url).pathname.replace('/helix/', ''), body: JSON.parse(body) }
  calls.push(call)
  return Response.json({ data: [reply(call)] })
}
// Streamer mode, signed in (Settings → Twitch).
const streamer = (on) => {
  twitch.status.mode = on ? 'streamer' : 'guest'
  Object.assign(auth.status, { login: on ? 'me' : '', scopesOk: on })
}

const vote = (option, user) => ({ action: 'vote', input: { option, user } })
const runtime = async (id) => (await read(id)).runtime
const output = async (id) => types.voting.output(await read(id))
// The clock and timers, so voting's duration passes at once.
const clock = (t) => t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 })

test('chat: start opens voting for its duration (30s at least), and the run ends with the results once time is up', async (t) => {
  clock(t)
  const { id } = await create('voting', { options: ['Red', 'Blue', 'Green'], duration: 5 })
  const { runtime: opened, done } = await update(id, { action: 'start' })
  assert.deepEqual([opened.open, opened.endsAt, opened.counts], [true, 1_000_000 + 30_000, [0, 0, 0]])
  await update(id, vote('2', 'ana'))
  await update(id, vote('blue', 'bob'))
  await update(id, vote('RED', 'cy'))
  t.mock.timers.tick(30_000)
  assert.equal(await done, true) // the votes didn't replace it
  assert.deepEqual(await output(id), { winner: 'Blue', votes: 3, winners: 'ana, bob' })
})

test('chat: one vote per viewer, the last one counts; unknown options and late votes are ignored', async (t) => {
  clock(t)
  const { id } = await create('voting', { options: ['Red', 'Blue'], duration: 60 })
  await update(id, { action: 'start' })
  await update(id, vote('1', 'ana'))
  await update(id, vote('2', 'ana'))
  assert.deepEqual((await runtime(id)).counts, [0, 1])
  assert.equal(await (await update(id, vote('purple', 'bob'))).done, false)
  assert.equal(await (await update(id, vote('3', 'bob'))).done, false)
  t.mock.timers.tick(60_001)
  await update(id, vote('1', 'cy'))
  assert.deepEqual((await runtime(id)).counts, [0, 1])
})

test('chat: stop closes voting and the workflow goes on with the results; a new start clears the votes', async (t) => {
  clock(t)
  const { id } = await create('voting', { options: ['Red', 'Blue'] })
  const { done } = await update(id, { action: 'start' })
  await update(id, vote('1', 'ana'))
  assert.equal((await update(id, { action: 'onStop' })).runtime.open, false)
  t.mock.timers.tick(0)
  assert.equal(await done, true)
  await update(id, vote('2', 'bob'))
  assert.deepEqual(await output(id), { winner: 'Red', votes: 1, winners: 'ana' })
  await update(id, { action: 'start' })
  assert.deepEqual(await runtime(id).then(({ votes, counts }) => ({ votes, counts })), { votes: {}, counts: [0, 0] })
})

test('chat: a prediction\'s "win" reveals the outcome and who bet on it, once', async (t) => {
  clock(t)
  const { id } = await create('voting', { kind: 'prediction', options: ['Red', 'Blue'] })
  const { done } = await update(id, { action: 'start' })
  for (const [option, user] of [['1', 'ana'], ['2', 'bob'], ['2', 'cy']]) await update(id, vote(option, user))
  await update(id, { action: 'win', input: { option: 'blue' } })
  assert.equal(await done, true) // over: voting closed
  assert.deepEqual(await output(id), { winner: 'Blue', votes: 3, winners: 'bob, cy' })
  await update(id, { action: 'win', input: { option: 'red' } })
  assert.equal((await runtime(id)).winner, 1)
  const { id: poll } = await create('voting', {})
  await update(poll, { action: 'start' })
  assert.equal(await (await update(poll, { action: 'win', input: { option: '1' } })).done, false) // a poll has no winner
})

test('Twitch: start needs Streamer mode, signed in', async (t) => {
  clock(t)
  streamer(false)
  const { id } = await create('voting', { mode: 'twitch' })
  await assert.rejects(update(id, { action: 'start' }), { status: 503, message: /Settings → Twitch/ })
  assert.equal((await runtime(id)).open, false)
})

test('Twitch: start opens a Twitch poll within its limits, EventSub brings its results, and its end closes voting', async (t) => {
  clock(t)
  streamer(true)
  t.after(() => streamer(false))
  reply = () => ({ id: 'poll-1', choices: [{ id: 'c1' }, { id: 'c2' }] })
  const { id } = await create('voting', { mode: 'twitch', title: 'x'.repeat(70), options: ['A', 'B', 'C', 'D', 'E', 'F'], duration: 90 })
  const { done } = await update(id, { action: 'start' })
  const { body } = calls.at(-1)
  assert.deepEqual([calls.at(-1).path, body.broadcaster_id, body.title.length, body.choices.length, body.duration], ['polls', '42', 60, 5, 90])
  assert.equal(await (await update(id, vote('1', 'ana'))).done, false) // no chat votes

  bus.emit('channel.poll.progress', { id: 'poll-1', choices: [{ id: 'c2', votes: 3, channel_points_votes: 10 }, { id: 'c1', votes: 1 }] })
  bus.emit('channel.poll.progress', { id: 'another', choices: [{ id: 'c1', votes: 99 }] })
  await new Promise(setImmediate)
  assert.deepEqual(await runtime(id).then(({ counts, points }) => ({ counts, points })), { counts: [1, 3], points: [0, 10] })
  bus.emit('channel.poll.end', { id: 'poll-1', choices: [{ id: 'c1', votes: 1 }, { id: 'c2', votes: 4 }] })
  assert.equal(await done, true)
  assert.deepEqual(await output(id), { winner: 'B', votes: 5, winners: '' })
})

test('Twitch: stop ends the poll on Twitch, but not once its time is up', async (t) => {
  clock(t)
  streamer(true)
  t.after(() => streamer(false))
  reply = (call) => ({ id: 'poll-2', choices: [{ id: 'c1', votes: call.method === 'PATCH' ? 2 : 0 }, { id: 'c2' }] })
  const { id } = await create('voting', { mode: 'twitch', duration: 60 })
  await update(id, { action: 'start' })
  const { runtime: stopped } = await update(id, { action: 'onStop' })
  assert.deepEqual(calls.at(-1), { method: 'PATCH', path: 'polls', body: { broadcaster_id: '42', id: 'poll-2', status: 'TERMINATED' } })
  assert.deepEqual([stopped.open, stopped.counts], [false, [2, 0]])

  await update(id, { action: 'start' })
  t.mock.timers.tick(60_000)
  const before = calls.length
  assert.equal((await update(id, { action: 'onStop' })).runtime.open, false)
  assert.equal(calls.length, before) // Twitch has ended it already
})

test('Twitch: a prediction locks on stop, and "win" resolves it, with its top predictors as winners', async (t) => {
  clock(t)
  streamer(true)
  t.after(() => streamer(false))
  const outcomes = [{ id: 'o1', users: 1 }, { id: 'o2', users: 2, top_predictors: [{ user_name: 'ana' }, { user_name: 'bob' }] }]
  reply = () => ({ id: 'pred-1', outcomes })
  const { id } = await create('voting', { mode: 'twitch', kind: 'prediction', title: 'y'.repeat(50), options: ['Red', 'Blue'] })
  await update(id, { action: 'start' })
  assert.deepEqual([calls.at(-1).path, calls.at(-1).body.title.length, calls.at(-1).body.prediction_window], ['predictions', 45, 60])
  await update(id, { action: 'onStop' })
  assert.deepEqual(calls.at(-1).body, { broadcaster_id: '42', id: 'pred-1', status: 'LOCKED' })
  await update(id, { action: 'win', input: { option: '2' } })
  assert.deepEqual(calls.at(-1).body, { broadcaster_id: '42', id: 'pred-1', status: 'RESOLVED', winning_outcome_id: 'o2' })
  assert.deepEqual(await output(id), { winner: 'Blue', votes: 3, winners: 'ana, bob' })
})

test('Twitch: a prediction resolved on Twitch shows its outcome', async (t) => {
  clock(t)
  streamer(true)
  t.after(() => streamer(false))
  reply = () => ({ id: 'pred-2', outcomes: [{ id: 'o1' }, { id: 'o2' }] })
  const { id } = await create('voting', { mode: 'twitch', kind: 'prediction', options: ['Red', 'Blue'] })
  const { done } = await update(id, { action: 'start' })
  bus.emit('channel.prediction.end', { id: 'pred-2', winning_outcome_id: 'o1', outcomes: [{ id: 'o1', users: 4 }, { id: 'o2', users: 1 }] })
  assert.equal(await done, true)
  assert.deepEqual(await output(id), { winner: 'Red', votes: 5, winners: '' })
})
