// The widget node: a signal runs the widget's onSignal action with its saved inputs; a Widget Action runs its own.
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

test('a Widget Action with no action runs onStop and stops the flow', async () => {
  const { id } = await create('greeter')
  const from = { type: 'widget-action', config: { action: '', input: {} } }
  assert.equal(await node.run({ config: { widget: id }, data: {}, from, signal }), null)
  assert.equal((await read(id)).runtime.ended, true)
})
