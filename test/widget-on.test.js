// A widget type's on handlers (bus events, e.g. Twitch results): they update the loaded widgets of the type and their
// pages, save a changed state, end what plays once over(), and are set up again, once, when the type reloads.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
await fs.writeFile('package.json', '{ "type": "module" }')
// A ticker: "start" opens it; "ticker.tick" adds to it while open (nothing otherwise), "ticker.end" closes it.
const ticker = (label) => `export default {
  type: 'ticker', label: '${label}', runtime: { n: 0, open: false },
  playTime: () => 1000,
  over: ({ runtime }) => !runtime.open,
  actions: { start: { run: ({ runtime }) => ({ runtime: { ...runtime, open: true } }) } },
  on: {
    'ticker.tick': ({ runtime }, data, ovrly) => runtime.open ? { runtime: { ...runtime, n: runtime.n + Number(ovrly.fill('{{by}}', data)) } } : undefined,
    'ticker.end': ({ runtime }) => ({ runtime: { ...runtime, open: false } }),
    'ticker.rename': ({ state }, data) => ({ state: { ...state, name: data.name } }),
    'ticker.fail': () => { throw new Error('bad event') },
  },
}`
await fs.mkdir('data/custom/widgets/ticker', { recursive: true })
await fs.writeFile('data/custom/widgets/ticker/widget.js', ticker('Ticker'))
await fs.writeFile('data/custom/widgets/ticker/index.html', '<!doctype html>')
const { default: bus } = await import('../server/bus.js')
const { create, read, update, attach, loadTypes, changes } = await import('../server/widgets.js')

const started = async () => {
  const { id } = await create('ticker')
  await update(id, { action: 'start' })
  return id
}
const handled = () => new Promise(setImmediate) // the handlers have run
const count = async (id) => (await read(id)).runtime.n

test('an event updates every loaded widget of the type, and its pages', async () => {
  const [one, two] = [await started(), await started()]
  const sent = []
  await attach(one, { write: (msg) => sent.push(msg) })
  bus.emit('ticker.tick', { by: '2' })
  await handled()
  assert.deepEqual([await count(one), await count(two)], [2, 2])
  assert.match(sent.at(-1), /"n":2/)
})

test('a handler returning nothing changes nothing', async () => {
  const { id } = await create('ticker') // not started: closed
  const sent = []
  await attach(id, { write: (msg) => sent.push(msg) })
  bus.emit('ticker.tick', { by: '1' })
  await handled()
  assert.equal(await count(id), 0)
  assert.equal(sent.length, 1) // only the snapshot sent on attach
})

test('a state a handler changes is saved', async () => {
  const { id } = await create('ticker')
  // Every loaded ticker is renamed, one after another: wait for this one's file.
  const saved = new Promise((resolve) => changes.on('state', function seen(widget) {
    if (widget.id === id) changes.off('state', seen), resolve()
  }))
  bus.emit('ticker.rename', { name: 'Score' })
  await saved
  assert.equal(JSON.parse(await fs.readFile(`data/widgets/${id}.json`, 'utf8')).state.name, 'Score')
})

test('a widget not loaded since the start gets no events', async () => {
  await fs.writeFile('data/widgets/old.json', JSON.stringify({ id: 'old', type: 'ticker', state: { name: 'Old' } }))
  bus.emit('ticker.rename', { name: 'New' })
  await handled()
  assert.equal(JSON.parse(await fs.readFile('data/widgets/old.json', 'utf8')).state.name, 'Old')
})

test('an event that makes it over ends what plays as finished, at once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] }) // the 1s playTime
  const { id } = await create('ticker')
  const { done } = await update(id, { action: 'start' })
  let played
  done.then((p) => (played = p))
  bus.emit('ticker.end', {})
  await handled()
  assert.equal(played, true)
})

test('a failing handler is logged, not thrown', async (t) => {
  const logged = t.mock.method(console, 'error', () => {})
  bus.emit('ticker.fail', {})
  await handled()
  assert.match(String(logged.mock.calls[0].arguments), /\[ticker\].*bad event/)
})

test('a reload sets the handlers up again, once', async () => {
  await fs.writeFile('data/custom/widgets/ticker/widget.js', ticker('Ticker 2'))
  await loadTypes()
  const id = await started()
  bus.emit('ticker.tick', { by: '1' })
  await handled()
  assert.equal(await count(id), 1)
})
