// The engine's walk: which outputs continue, Fan Out's items, earlier outputs ($node), Queue's line, Wait For All's
// Force and Cancel, cancelling a workflow, failures reaching Error Trigger workflows, and Execute Workflow.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { fire, line, drop, arrived, unjoin, cancel } = await import('../server/engine.js')
const store = await import('../server/store.js')
const { default: bus } = await import('../server/bus.js')

const node = (id, type, config = {}) => ({ id, data: { type, config } })
const edge = (source, target, sourceHandle) => ({ id: `${source}-${target}`, source, target, sourceHandle })
const code = (id, js) => node(id, 'code', { code: js })
const workflow = (id, nodes, edges) => ({ id, name: id, nodes, edges })
const trigger = (id = 't') => node(id, 'manual', { data: '{}' })
// A Code node that waits until the test opens the gate (code runs in this process, so it sees globalThis).
const gated = (id) => code(id, 'await globalThis.gate; return data')
function closeGate() {
  let open
  globalThis.gate = new Promise((resolve) => (open = resolve))
  return open
}
const pending = () => new Promise(setImmediate) // the firings have run until they wait

test('only the outputs a node returns continue', async () => {
  const wf = workflow('branch', [trigger(), node('if', 'if-else', { value: '{{n}}', operator: '>', compare: '5' }),
    code('yes', 'return { ...data, yes: true }'), code('no', 'return { ...data, no: true }')],
  [edge('t', 'if'), edge('if', 'yes', 'true'), edge('if', 'no', 'false')])
  const [high] = await fire(wf, 'manual', { n: 9 })
  assert.deepEqual(Object.keys(high.outputs).filter((k) => ['yes', 'no'].includes(k)), ['yes'])
  const [low] = await fire(wf, 'manual', { n: 1 })
  assert.deepEqual(Object.keys(low.outputs).filter((k) => ['yes', 'no'].includes(k)), ['no'])
})

test('Fan Out continues once per item, in order', async () => {
  const wf = workflow('fan', [trigger(), node('fan', 'fan-out', { list: '{{names}}' }), code('each', 'return data')],
    [edge('t', 'fan'), edge('fan', 'each')])
  const [run] = await fire(wf, 'manual', { names: ['a', 'b', 'c'] })
  const each = run.record.nodes.filter((n) => n.node === 'each').map((n) => [n.output.item, n.output.index])
  assert.deepEqual(each, [['a', 0], ['b', 1], ['c', 2]])
})

test('a node reads an earlier output with $node, which does not travel on with the data', async () => {
  const wf = workflow('earlier', [trigger(), code('a', 'return { x: 1 }'), code('b', 'return { y: 2 }'),
    node('c', 'edit-data', { values: [{ name: 'fromA', value: '{{$node.a.x}}' }] })],
  [edge('t', 'a'), edge('a', 'b'), edge('b', 'c')])
  const [run] = await fire(wf, 'manual', {})
  assert.deepEqual(run.outputs.c, { y: 2, fromA: 1 })
})

test('a queue lets one firing through at a time, the next ones wait in line, up to its max', async () => {
  const open = closeGate()
  const wf = workflow('queue', [trigger(), node('q', 'queue', { max: 1 }), gated('slow')], [edge('t', 'q'), edge('q', 'slow')])
  const firings = [1, 2, 3].map((n) => fire(wf, 'manual', { n }))
  await pending()
  assert.deepEqual(line('queue', 'q').map((e) => e.data.n), [2]) // 3 was dropped: the line was full
  open()
  const runs = await Promise.all(firings)
  assert.deepEqual(runs.map(([run]) => 'slow' in run.outputs), [true, true, false])
})

test('a firing removed from a queue\'s line stops there', async () => {
  const open = closeGate()
  const wf = workflow('drop', [trigger(), node('q', 'queue'), gated('slow')], [edge('t', 'q'), edge('q', 'slow')])
  const firings = [1, 2].map((n) => fire(wf, 'manual', { n }))
  await pending()
  const [waiting] = line('drop', 'q')
  assert.equal(drop('drop', 'q', waiting.id), true)
  assert.equal(drop('drop', 'q', waiting.id), false)
  open()
  const runs = await Promise.all(firings)
  assert.deepEqual(runs.map(([run]) => 'slow' in run.outputs), [true, false])
})

test('Force continues a Wait For All with what arrived, Cancel drops the wait', async () => {
  const join = (id) => workflow(id, [trigger('t1'), trigger('t2'), node('w', 'wait-all'), code('after', 'return data')],
    [edge('t1', 'w'), edge('t2', 'w'), edge('w', 'after')])
  const forced = fire(join('force'), 'manual', { a: 1 }, {}, 't1')
  await pending()
  assert.deepEqual(arrived('force', 'w'), ['t1-w'])
  assert.equal(unjoin('force', 'w', true), true)
  assert.deepEqual((await forced)[0].outputs.after, { a: 1 })

  const dropped = fire(join('drop-wait'), 'manual', { a: 1 }, {}, 't1')
  await pending()
  assert.equal(unjoin('drop-wait', 'w', false), true)
  assert.equal('after' in (await dropped)[0].outputs, false)
  assert.equal(unjoin('drop-wait', 'w', false), false) // nothing waits anymore
})

test('cancelling a workflow stops its firings wherever they wait', async () => {
  const wf = workflow('cancel', [trigger('t1'), trigger('t2'), trigger('t3'), node('d', 'delay', { seconds: 10 }),
    node('w', 'wait-all'), code('after', 'return data')],
  [edge('t1', 'd'), edge('d', 'after'), edge('t2', 'w'), edge('t3', 'w'), edge('w', 'after')])
  const firings = [fire(wf, 'manual', {}, {}, 't1'), fire(wf, 'manual', {}, {}, 't2')]
  await pending()
  cancel('cancel')
  const runs = (await Promise.all(firings)).map(([run]) => run)
  assert.deepEqual(runs.map((run) => run.record.status), ['stopped', 'stopped'])
  assert.equal(runs.some((run) => 'after' in run.outputs), false)
  assert.deepEqual(arrived('cancel', 'w'), [])
})

test('a failure is reported to Error Trigger workflows, but not one in such a workflow', async (t) => {
  const heard = []
  const listen = (error) => heard.push(error)
  bus.on('workflow-error', listen)
  t.after(() => bus.off('workflow-error', listen))
  t.mock.method(console, 'error', () => {}) // the engine logs the failure
  const failing = workflow('fails', [trigger(), code('boom', 'throw new Error("boom")')], [edge('t', 'boom')])
  const [run] = await fire(failing, 'manual', {})
  assert.equal(run.record.status, 'error')
  await fire({ ...failing, id: 'guarded', name: 'guarded', nodes: [...failing.nodes, node('e', 'error-trigger')] }, 'manual', {})
  assert.deepEqual(heard, [{ workflow: 'fails', node: 'Code', error: run.error.message }])
})

test('Execute Workflow merges the called workflow\'s last data, fails when it fails, and stops calls 10 deep', async (t) => {
  t.mock.method(console, 'error', () => {})
  const callee = (id, js) => store.save('workflows', workflow(id, [node('c', 'workflow-call', { id: 'main' }), code('x', js)], [edge('c', 'x')]))
  await callee('double', 'return { doubled: data.n * 2 }')
  await callee('broken', 'throw new Error("nope")')
  const caller = (target) => workflow(`call-${target}`, [trigger(), node('x', 'execute-workflow', { workflow: `${target}/main` })], [edge('t', 'x')])
  const [run] = await fire(caller('double'), 'manual', { n: 2 })
  assert.deepEqual(run.outputs.x, { n: 2, doubled: 4 })
  const [failed] = await fire(caller('broken'), 'manual', {})
  assert.match(failed.error.message, /"broken" failed: .*nope/)
  const [deep] = await fire(caller('double'), 'manual', { n: 2 }, { depth: 10 })
  assert.match(deep.error.message, /too deep/)
})
