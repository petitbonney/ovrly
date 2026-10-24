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
