// Widget types on the state/runtime contract: what their actions return.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { types } = await import('../server/widgets.js')

const run = (t, action, input = {}, state = {}, runtime = {}) =>
  types[t].actions[action].run({ state: { ...types[t].state, ...state }, runtime: { ...types[t].runtime, ...runtime }, input })
const start = (t, input) => run(t, 'start', input)

test('alerts start queues a text', () => {
  const { runtime } = start('alerts', { text: 'hi' })
  assert.equal(runtime.n, 1)
  assert.equal(runtime.items[0].text, 'hi')
  assert.equal(types.alerts.queues('start', { state: { ...types.alerts.state, layout: 'ticket' } }), true)
})

test('image start serves a path', () => {
  assert.equal(start('image', { image: '/tmp/a.png' }).runtime.url, '/file?path=%2Ftmp%2Fa.png')
  assert.equal(start('image', { image: 'https://x/a.gif' }).runtime.url, 'https://x/a.gif')
})

test('sound and video start set the url', () => {
  assert.equal(start('sound', { sound: 'https://x/a.mp3' }).runtime.url, 'https://x/a.mp3')
  assert.equal(start('video', { video: 'https://x/a.mp4' }).runtime.url, 'https://x/a.mp4')
})

test('lottery load and loadAll add to state.options', async () => {
  const { choices, PALETTES } = await import('../widgets/lottery/widget.js')
  const one = run('lottery', 'load', { label: ' A ', weight: '' }, { options: [] })
  assert.deepEqual(one.state.options, [{ label: 'A', weight: 1 }])
  const all = run('lottery', 'loadAll', { options: [{ label: 'B', weight: 2 }, { label: 'C' }] }, one.state)
  assert.deepEqual(all.state.options.map((o) => o.weight), [1, 2, 1])
  assert.equal(choices(all.state)[0].color, PALETTES.ovrly.colors[0])
  assert.throws(() => run('lottery', 'load', { label: '' }), /needs a label/)
})

test('roulette and dice draw a winner among their choices', () => {
  const roulette = start('roulette').runtime.winner
  assert.ok(roulette >= 0 && roulette <= 36)
  const runtime = start('dice').runtime
  assert.equal(types.dice.output({ state: types.dice.state, runtime }).winner, String(runtime.winner + 1))
})

test('voting counts a chat vote in runtime', () => {
  const out = run('voting', 'vote', { option: '2', user: 'bob' }, {}, { open: true, endsAt: Date.now() + 60000, counts: [0, 0] })
  assert.deepEqual(out.runtime.counts, [0, 1])
  assert.equal('state' in out, false)
})

test('twitch plays mode changes the setting', () => {
  const out = run('twitch-plays', 'mode', { mode: 'democracy' })
  assert.equal(out.state.mode, 'democracy')
  assert.equal(out.runtime.loop, -1)
  assert.equal(run('twitch-plays', 'mode', { mode: 'anarchy' }), undefined)
})

test('twitch plays stop keeps the mode', () => {
  const out = run('twitch-plays', 'stop', {}, {}, { listening: true })
  assert.equal('state' in out, false)
  assert.equal(out.runtime.listening, false)
})
