// The widget node: a link into its main port runs the widget's onSignal action with its saved inputs; one into an
// action port runs that action with its saved inputs too.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { counter } from './fixture-type.js'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { types, normalize, create, read } = await import('../server/widgets.js')
const { default: node } = await import('../server/nodes/widget.js')
const greet = { inputs: { who: { vars: true } }, run: ({ runtime, input }) => ({ runtime: { ...runtime, last: input.who } }) }
types.greeter = normalize({ ...counter, type: 'greeter', onSignal: 'greet', actions: { ...counter.actions, greet } })
const signal = new AbortController().signal

test('a signal runs onSignal with the saved inputs', async () => {
  const { id } = await create('greeter', { input: { greet: { who: '{{user}}' } } })
  assert.notEqual(await node.run({ config: { widget: id }, data: { user: 'bob' }, signal }), null)
  assert.equal((await read(id)).runtime.last, 'bob')
})

test('a link into an action port runs it with its saved inputs and stops the flow', async () => {
  const { id } = await create('greeter', { input: { add: { n: '{{n}}' } } })
  const from = { type: 'manual', config: {}, port: 'add' }
  assert.equal(await node.run({ config: { widget: id, ports: ['add'] }, data: { n: 3 }, from, signal }), null)
  assert.equal((await read(id)).state.total, 3)
})

test('a link into the stop port ends the widget', async () => {
  const { id } = await create('greeter')
  const from = { type: 'manual', config: {}, port: 'stop' }
  assert.equal(await node.run({ config: { widget: id, ports: ['stop'] }, data: {}, from, signal }), null)
  assert.equal((await read(id)).runtime.ended, true)
})
