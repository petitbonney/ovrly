// Logic nodes on their own: what If / Else, Filter, Switch, Map Value, Cooldown, Fan In, Fan Out, Code and Edit
// Variable return for a config and data.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const node = async (type) => (await import(`../server/nodes/${type}.js`)).default
const [ifElse, filter, switchNode, mapValue, cooldown, fanIn, fanOut, code, editVariable] = await Promise.all(
  ['if-else', 'filter', 'switch', 'map-value', 'cooldown', 'fan-in', 'fan-out', 'code', 'edit-variable'].map(node))
const store = await import('../server/store.js')

// Runs a node as the engine does: its config over the type's defaults.
const run = (def, config, data = {}, id = 'n') => def.run({ config: { ...def.config, ...config }, data, id, signal: new AbortController().signal })
const savedVars = async () => (await store.get('settings', 'vars')).values

test('If / Else compares the filled values, ignoring case unless Match case is on', () => {
  const cases = [
    // operator, value, compare with, match case, holds
    ['equals', 'Hello', 'hello', false, true],
    ['equals', 'Hello', 'hello', true, false],
    ['not equals', 'a', 'b', false, true],
    ['contains', '!Dice now', '!dice', false, true],
    ['not contains', 'hi', 'x', false, true],
    ['starts with', '!Roll 2', '!roll', false, true],
    ['ends with', 'clip.MP4', '.mp4', false, true],
    ['matches', 'ABC', '^abc$', false, true],
    ['matches', 'ABC', '^abc$', true, false],
    ['matches', 'abc', '^\\D+$', false, true], // the pattern isn't lowercased: \D stays "not a digit"
    ['>', '10', '9', false, true], // as numbers, not text
    ['<', '2', '10', false, true],
    ['>=', '5', '5', false, true],
    ['<=', '6', '5', false, false],
    ['is empty', '', '', false, true],
    ['not empty', ' ', '', false, true],
  ]
  for (const [operator, value, compare, matchCase, holds] of cases) {
    assert.deepEqual(Object.keys(run(ifElse, { value, operator, compare, matchCase })), [String(holds)], `"${value}" ${operator} "${compare}"`)
  }
  const data = { user: 'Ana', owner: 'ana' }
  assert.deepEqual(run(ifElse, { value: '{{user}}', operator: 'equals', compare: '{{owner}}' }, data), { true: data })
  assert.throws(() => run(ifElse, { operator: '~' }), /If \/ Else: unknown operator "~"/)
})

test('Filter lets the data through only when the comparison holds', () => {
  const config = { value: '{{bits}}', operator: '>=', compare: '100' }
  assert.deepEqual(run(filter, config, { bits: 150 }), { bits: 150 })
  assert.equal(run(filter, config, { bits: 50 }), null)
})

test('Switch sends the data to the first case equal to the value, else to "else"', () => {
  const config = { value: '{{args}}', cases: ['Red', '', 'blue', 'BLUE'] }
  assert.deepEqual(run(switchNode, config, { args: 'red' }), { 1: { args: 'red' } })
  assert.deepEqual(Object.keys(run(switchNode, config, { args: 'Blue' })), ['3'])
  assert.deepEqual(Object.keys(run(switchNode, config, { args: '' })), ['else']) // an empty case never matches
  assert.deepEqual(Object.keys(run(switchNode, config, { args: 'green' })), ['else'])
})

test('Map Value replaces a key\'s value by the first equal "from", else keeps, defaults or stops', () => {
  const map = [{ from: '', to: 'never' }, { from: 'Red', to: '#f00' }, { from: 'double', to: '{{ n * 2 }}' }, { from: 'red', to: 'second' }]
  const config = { key: 'color', map }
  assert.deepEqual(run(mapValue, config, { color: 'RED' }), { color: '#f00' })
  assert.deepEqual(run(mapValue, config, { color: 'double', n: 3 }), { color: 6, n: 3 }) // a lone {{ }} keeps its type
  assert.deepEqual(run(mapValue, { ...config, matchCase: true }, { color: 'RED' }), { color: 'RED' })
  assert.deepEqual(run(mapValue, config, { color: '' }), { color: '' })
  assert.deepEqual(run(mapValue, config, {}), {})
  assert.deepEqual(run(mapValue, { ...config, noMatch: 'default', fallback: '{{user}}' }, { color: 'green', user: 'ana' }), { color: 'ana', user: 'ana' })
  assert.equal(run(mapValue, { ...config, noMatch: 'stop' }, { color: 'green' }), null)
  assert.throws(() => run(mapValue, { key: '' }), /Map Value: no key set/)
})

test('Cooldown blocks for a while, for everyone and per key, until its time is up or it is dropped', (t) => {
  t.mock.timers.enable({ apis: ['Date'] })
  const pass = (user) => run(cooldown, { seconds: 10, byKey: true, key: 'user', keySeconds: 60 }, { user }, 'cd')
  assert.deepEqual(pass('ana'), { pass: { user: 'ana' } })
  t.mock.timers.tick(9_700)
  assert.deepEqual(pass('bob'), { blocked: { user: 'bob', remaining: 1 } }) // seconds left, rounded up
  t.mock.timers.tick(300)
  assert.deepEqual(pass('ana'), { blocked: { user: 'ana', remaining: 50 } }) // her own cooldown
  assert.deepEqual(pass('bob'), { pass: { user: 'bob' } })
  assert.deepEqual(cooldown.live('cd'), { left: 10_000, keys: [{ key: 'ana', left: 50_000 }, { key: 'bob', left: 60_000 }] })
  assert.equal(cooldown.control('cd', 'drop'), true)
  assert.equal(cooldown.control('cd', 'drop', 'ana'), true)
  assert.deepEqual(Object.keys(pass('ana')), ['pass'])
})

test('Fan In collects firings into one list, released at its limit; one entry per key keeps the first or last', async () => {
  const collect = async (config, entries, id) => {
    const [first, ...others] = entries.map((data) => run(fanIn, { duration: 0, ...config }, data, id))
    assert.deepEqual(await Promise.all(others), others.map(() => null)) // only the first firing goes on
    return first
  }
  assert.deepEqual(await collect({ limit: 3, item: '{{user}}' }, [{ user: 'a' }, { user: 'b' }, { user: 'c' }], 'limit'),
    { items: ['a', 'b', 'c'], count: 3 })
  const votes = [{ user: 'a', n: 1 }, { user: 'a', n: 2 }, { user: 'b', n: 3 }]
  const byUser = { limit: 2, byKey: true, key: 'user', item: '{{n}}' }
  assert.deepEqual((await collect(byUser, votes, 'first')).items, [1, 3])
  assert.deepEqual((await collect({ ...byUser, keep: 'last' }, votes, 'last')).items, [2, 3])
  await assert.rejects(run(fanIn, { duration: 0 }), /Fan In: set a duration, a quiet period or a limit/)
})

test('Fan In releases after its duration or a quiet period, and Cancel drops what it holds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const timed = run(fanIn, { duration: 10 }, { user: 'a' }, 'timed')
  await run(fanIn, { duration: 10 }, { user: 'b' }, 'timed')
  t.mock.timers.tick(10_000)
  assert.deepEqual(await timed, { items: [{ user: 'a' }, { user: 'b' }], count: 2 }) // no entry set: the whole data

  const quiet = { duration: 0, quiet: 2 }
  let released = false
  const calm = run(fanIn, quiet, {}, 'quiet').then((out) => (released = out))
  t.mock.timers.tick(1_500)
  await run(fanIn, quiet, {}, 'quiet') // a new event: the quiet period starts again
  t.mock.timers.tick(1_500)
  await new Promise(setImmediate)
  assert.equal(released, false)
  t.mock.timers.tick(500)
  assert.equal((await calm).count, 2)

  const dropped = run(fanIn, { duration: 10 }, {}, 'cancel')
  assert.equal(fanIn.control('cancel', 'cancel'), true)
  assert.equal(await dropped, null)
  assert.equal(fanIn.live('cancel'), null)
})

test('Fan Out gives each item its index and the count, and needs a list', () => {
  assert.deepEqual(run(fanOut, { list: '{{names}}' }, { names: ['a'] }), [{ names: ['a'], item: 'a', index: 0, count: 1 }])
  assert.throws(() => run(fanOut, { list: ' ' }), /Fan Out: no list set/)
  assert.throws(() => run(fanOut, { list: '{{name}}' }, { name: 'a' }), /"{{name}}" is not a list/)
})

test('Code returns the new data, keeps it when returning nothing, and says on which line it failed', async () => {
  const data = { n: 2 }
  assert.deepEqual(await run(code, { code: 'return { n: data.n + 1 }' }, data), { n: 3 })
  assert.equal(await run(code, { code: 'const unused = 1' }, data), data)
  assert.equal(await run(code, { code: 'return null' }, data), null)
  await assert.rejects(run(code, { code: 'return 5' }), /return an object, or null to stop/)
  await assert.rejects(run(code, { code: 'return [1]' }), /return an object, or null to stop/)
  await assert.rejects(run(code, { code: 'const a = 1\nnull.x' }), /^TypeError: Line 2: /)
})

test('Code saves the variables it changes', async () => {
  await run(code, { code: '$vars.seen = data.n' }, { n: 7 })
  assert.equal((await savedVars()).seen, 7)
})

test('Edit Variable sets, adds to and deletes a variable, and saves it', async () => {
  assert.deepEqual(await run(editVariable, { name: 'score', operation: 'set', value: '{{n}}' }, { n: 5 }), { n: 5, value: 5 })
  assert.equal((await run(editVariable, { name: 'score', operation: 'add', value: '2' })).value, 7)
  assert.equal((await savedVars()).score, 7)
  await run(editVariable, { name: 'word', operation: 'set', value: 'abc' })
  assert.equal((await run(editVariable, { name: 'word', operation: 'add', value: '1' })).value, 1) // text counts as 0
  assert.equal((await run(editVariable, { name: 'score', operation: 'delete' })).value, undefined)
  assert.equal('score' in (await savedVars()), false)
  await assert.rejects(run(editVariable, { name: 'a b' }), /the name takes letters, digits/)
  await assert.rejects(run(editVariable, { operation: 'times' }), /unknown operation "times"/)
})
