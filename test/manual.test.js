// Triggers fired by hand (engine.js fireManual): each trigger type's first inputs get through its default settings,
// inputs saved with the node and given by the editor win in that order, a filtered or failing one says so, and the
// answer comes once the trigger has fired, not at the end of the firing.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { nodes, fireManual } = await import('../server/engine.js')

const workflow = (trigger) => ({ id: 'w', name: 'w', nodes: [trigger, { id: 'next', data: { type: 'code', config: { code: 'return data' } } }],
  edges: [{ id: 't-next', source: 't', target: 'next' }] })
const node = (type, config = {}, manual) => ({ id: 't', data: { type, config, ...(manual && { manual }) } })

test('every trigger type with manual fires with its first inputs on its default settings', async () => {
  const types = Object.values(nodes).filter((d) => d.manual).map((d) => d.type)
  assert.ok(types.length >= 16)
  for (const type of types) {
    // A Control Pad has no buttons until some are added.
    const config = type === 'deck' ? { buttons: [{ id: 'ab12', name: 'Go', icon: 'bolt', color: '#ff0000' }] } : {}
    const answer = await fireManual(workflow(node(type, config)), 't')
    assert.ok(answer.out, `${type} didn't fire: ${JSON.stringify(answer)}`)
  }
})

test('the first inputs follow the settings, so the event gets through them', async () => {
  const { out } = await fireManual(workflow(node('cheer', { minBits: 500 })), 't')
  assert.equal(out.bits, 500)
  const command = await fireManual(workflow(node('chat-command', { command: '!spin+wheel', from: 'mod' })), 't', { inputs: { args: 'red 3' } })
  assert.deepEqual([command.out.command, command.out.args, command.out.mod], ['!spin', ['red', '3'], true])
})

test('saved inputs win over the first ones, and those given over the saved', async () => {
  const saved = workflow(node('cheer', {}, { bits: 42, user: 'Bob' }))
  assert.deepEqual((await fireManual(saved, 't')).out, { user: 'Bob', bits: 42, message: '' })
  assert.equal((await fireManual(saved, 't', { inputs: { bits: 7 } })).out.bits, 7)
  // The settings given (the editor's, maybe not saved yet) win over the saved ones.
  assert.deepEqual(await fireManual(saved, 't', { config: { minBits: 100 } }), {})
})

test('an event its settings filter out answers {}, a failing one its error', async () => {
  assert.deepEqual(await fireManual(workflow(node('cheer', { minBits: 100 }, { bits: 5 })), 't'), {})
  assert.match((await fireManual(workflow(node('webhook', {}, { body: '{oops' })), 't')).error, /JSON/)
  assert.equal(await fireManual(workflow(node('code')), 'next'), null) // not a trigger
})

test('it answers once the trigger has fired, while the rest still runs', async () => {
  let open
  globalThis.gate = new Promise((resolve) => (open = resolve))
  const wf = workflow(node('follow'))
  wf.nodes[1].data.config.code = 'await globalThis.gate; return data'
  assert.deepEqual(await fireManual(wf, 't'), { out: { user: 'TestViewer' } })
  open()
})

test('a Control Pad fires its first button the way its mode does', async () => {
  const buttons = [{ id: 'ab12', name: 'Go' }, { id: 'cd34', name: 'Stop' }]
  for (const mode of ['companion', 'streamdeck']) {
    const { out } = await fireManual(workflow(node('deck', { mode, buttons })), 't')
    assert.equal(out.button, 'Go')
  }
})
