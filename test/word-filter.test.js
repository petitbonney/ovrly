// Word Filter: what it masks (case, accents, leetspeak, repeats, dots, whole words, allowed words), Stop, and its lists
// downloaded once (fetch stubbed: no network).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
await fs.mkdir('data/word-lists', { recursive: true })
await fs.writeFile('data/word-lists/en.txt', 'ass\nfuck\nfucker\nshit\n2 girls 1 cup\n')
await fs.writeFile('data/word-lists/fr.txt', 'enculé\nmerde\n')
await fs.writeFile('data/word-lists/ja.txt', 'ばか\n')
const { default: filter } = await import('../server/nodes/word-filter.js')
const lists = await import('../server/integrations/word-lists.js')

const run = (message, config = {}) => filter.run({ config: { ...filter.config, ...config }, data: { message } })
const masked = async (message, config) => (await run(message, config)).message

test('masks the words of its lists, whatever their case, accents, leetspeak, repeats and dots', async () => {
  const cases = [
    ['Oh shit!', 'Oh s***!'],
    ['SHIT happens', 'S*** happens'],
    ['sh1t and $h!t', 's*** and $***'],
    ['fuuuuck', 'f******'],
    ['f.u.c.k off', 'f****** off'],
    ['you fucker', 'you f*****'], // the longest word, not "fuck" and a leftover "er"
    ['Encule! Merde', 'E*****! M****'], // accents in neither the text nor the list matter
    ['enculé', 'e*****'],
    ['2 girls  1 cup', '2*************'],
  ]
  for (const [text, out] of cases) assert.equal(await masked(text), out, text)
})

test('only whole words, unless the language has no spaces', async () => {
  assert.equal(await masked('a class in Scunthorpe, bass, assassin'), 'a class in Scunthorpe, bass, assassin')
  assert.equal(await masked('この ばか め', { lists: ['ja'] }), 'この ば* め')
  assert.equal(await masked('このばかめ', { lists: ['ja'] }), 'このば*め')
})

test('adds censored and badWords, masks with stars or a text, stops, and keeps other data', async () => {
  assert.deepEqual(await filter.run({ config: filter.config, data: { message: 'shit shit', user: 'Bob' } }),
    { message: 's*** s***', user: 'Bob', censored: true, badWords: 2 })
  assert.deepEqual(await run('hello'), { message: 'hello', censored: false, badWords: 0 })
  assert.equal(await masked('oh shit', { mask: 'stars' }), 'oh ****')
  assert.equal(await masked('oh shit', { mask: 'text', text: '[bip]' }), 'oh [bip]')
  assert.equal(await run('oh shit', { found: 'stop' }), null)
  assert.deepEqual(await run('oh hi', { found: 'stop' }), { message: 'oh hi', censored: false, badWords: 0 })
  assert.deepEqual(await filter.run({ config: filter.config, data: {} }), { message: '', censored: false, badWords: 0 })
  await assert.rejects(filter.run({ config: { ...filter.config, key: '' }, data: {} }), /no key set/)
})

test('extra words are masked too, allowed words never', async () => {
  assert.equal(await masked('what a noob, shit', { extra: 'noob', allowed: 'shit' }), 'what a n***, shit')
  assert.equal(await masked('Fuck', { lists: [], extra: 'fuck' }), 'F***')
  assert.equal(await masked('nothing here', { lists: [] }), 'nothing here')
})

test('a list is downloaded once, from the fixed commit; a failed download says which list and is tried again', async (t) => {
  const asked = []
  let answer = { ok: false, status: 503 }
  t.mock.method(globalThis, 'fetch', async (url) => (asked.push(url), answer))
  await assert.rejects(masked('mierda', { lists: ['es'] }), /couldn't download the Spanish list \(503\)/)
  answer = { ok: true, text: async () => 'mierda\n' }
  assert.equal(await masked('mierda', { lists: ['es', 'en'] }), 'm*****')
  assert.equal(await masked('MIERDA', { lists: ['es'] }), 'M*****')
  assert.equal(asked.length, 2)
  assert.match(asked[1], /LDNOOBW\/.+\/5faf2ba42d7b1c0977169ec3611df25a3c08eb13\/es$/)
  assert.equal(await fs.readFile('data/word-lists/es.txt', 'utf8'), 'mierda\n')
  await assert.rejects(lists.load('../secrets'), /unknown list/)
})

test('saving a workflow fetches the lists its Word Filter nodes picked, the default ones when unchanged', async (t) => {
  const asked = []
  t.mock.method(globalThis, 'fetch', async (url) => (asked.push(url.split('/').pop()), { ok: true, text: async () => 'x\n' }))
  lists.prefetch({ nodes: [{ data: { type: 'word-filter', config: { lists: ['de', 'it'] } } }, { data: { type: 'word-filter' } }, { data: { type: 'log' } }] })
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(asked.sort(), ['de', 'it']) // en and fr are already on disk
})
