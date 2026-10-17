// Workflow engine: on a bus event (or a schedule tick), runs every matching trigger and walks its edges.
import fs from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import bus from './bus.js'
import * as store from './store.js'

// Load every node type from ./nodes, keyed by type.
const dir = new URL('./nodes/', import.meta.url)
export const nodes = {}
for (const name of await fs.readdir(dir)) {
  const def = (await import(new URL(name, dir))).default
  nodes[def.type] = def
}

// Live run feedback for the editor (GET /api/activity): { workflow, node, state } where state is running, done,
// stopped (returned nothing), error or waiting (a join waiting for its other links), { workflow, edge, target }
// when data travels along a link, and { workflow, running } with the number of firings in progress.
export const activity = new EventEmitter()

// Queue nodes (`queue`): node key -> { tail: promise of the last firing in line, size: firings in line }.
const queues = {}
// Node key -> how many firings are running it: a node only shows as finished once the last one has.
const active = {}
// Workflow id -> abort controllers of its firings in progress, for cancel().
const runs = {}

// The last 100 firings that matched a trigger, newest first (GET /api/runs); in memory only. Each is
// { id, workflow, name, event, at, ms, status: running | done | stopped | error, nodes: [{ node, type, input, output,
// error, ms }] }, one entry per node that ran: output null means it stopped the branch.
export const history = []
let lastRun = 0

// Waits ms, or less if the firing is cancelled.
const sleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => resolve(clearTimeout(timer)), { once: true })
})

// Widget links join a widget node's diamond (sourceHandle "widget") to a Fire Widget node's diamond input
// (targetHandle "widget"). They carry no data: they say which widget instance the node drives.
function linkedWidget(workflow, node) {
  const link = workflow.edges.find((e) => e.target === node.id && e.targetHandle === 'widget')
  return workflow.nodes.find((n) => n.id === link?.source)?.data.config.widget
}

// Runs one node, then the nodes connected to its outputs. A null result stops the branch.
// `run` is the state of one trigger firing: its abort signal and the data waiting at "wait for all" (join) nodes.
async function walk(workflow, node, data, run) {
  if (run.signal.aborted) return
  const def = nodes[node.data.type]
  const status = (state, extra) => activity.emit('activity', { workflow: workflow.id, node: node.id, state, ...extra })
  if (def.join) {
    const arrived = (run.joins[node.id] ??= [])
    arrived.push(data)
    if (arrived.length < workflow.edges.filter((e) => e.target === node.id && e.targetHandle !== 'widget').length) return status('waiting')
    data = Object.assign({}, ...arrived)
  }
  // `id` keys a node's memory across firings (cooldown).
  const id = `${workflow.id}/${node.id}`
  const config = { ...def.config, ...node.data.config }
  // A queue node lets one firing at a time through: the next waits until everything after it has finished.
  if (def.queue) {
    const q = (queues[id] ??= { tail: Promise.resolve(), size: 0 })
    if (config.max > 0 && q.size > config.max) return status('stopped') // line full: dropped
    const turn = q.tail
    let release
    q.tail = new Promise((resolve) => (release = resolve))
    q.size++
    if (q.size > 1) status('waiting')
    await turn
    try {
      if (run.signal.aborted) return status('stopped')
      return await step(workflow, node, data, run, { def, config, id, status })
    } finally {
      q.size--
      release()
    }
  }
  return step(workflow, node, data, run, { def, config, id, status })
}

// Runs the node itself, then walks on from its outputs. Besides the data, the node can read {{ $node.<type>.<key> }},
// the output of an earlier node in this firing: data is copied with it attached out of sight (not enumerable), so
// it doesn't travel on with the data.
async function step(workflow, node, data, run, { def, config, id, status }) {
  data = Object.defineProperty({ ...data }, '$node', { value: run.outputs })
  // A trigger is only shown when it fires: most chat messages don't match most triggers.
  const trigger = def.category === 'trigger'
  if (!trigger) {
    active[id] = (active[id] ?? 0) + 1
    status('running')
  }
  // Ends this firing's run of the node; while other firings still run it (e.g. a widget restarted), it stays running.
  const end = (state, extra) => {
    if (trigger) return
    const others = --active[id]
    if (!others) delete active[id]
    if (others && state !== 'error') return
    status(state, extra)
  }
  const began = Date.now()
  const log = (extra) => run.record.nodes.push({ node: node.id, type: def.type, input: data, ...extra, ms: Date.now() - began })
  // Failures are retried `retries` times, waiting `retryWait` seconds; then the firing stops there, or with
  // onError "continue" the data goes on with { error }.
  let out, failed
  for (let attempt = 0; ; attempt++) {
    try {
      out = await def.run({ config, data, id, signal: run.signal, widget: linkedWidget(workflow, node), depth: run.depth })
      break
    } catch (err) {
      if (run.signal.aborted) return end('stopped') // e.g. an HTTP request cut short by cancel()
      if (attempt < (config.retries ?? 0)) {
        await sleep((config.retryWait ?? 1) * 1000, run.signal)
        continue
      }
      log({ error: err.message })
      if (config.onError !== 'continue') {
        run.failedNode = def.label
        end('error', { error: err.message })
        throw err
      }
      failed = err
      out = { ...data, error: err.message }
      break
    }
  }
  if (out == null || run.signal.aborted) {
    if (!trigger) log({ output: null })
    return end('stopped')
  }
  if (trigger) run.start()
  if (!failed) log({ output: out })
  end(failed ? 'error' : 'done', failed && { error: failed.message })
  // Nodes with several outputs (if/else, switch) return { [output]: data }; only those outputs continue.
  const multi = def.outputs || def.outputsFrom
  run.last = multi ? Object.values(out)[0] : out
  run.outputs[def.type] = run.outputs[node.id] = run.last
  const next = workflow.edges.filter((e) => e.source === node.id && e.sourceHandle !== 'widget' && (!multi || e.sourceHandle in out))
  await Promise.all(next.map((e) => {
    const target = workflow.nodes.find((n) => n.id === e.target)
    if (target) activity.emit('activity', { workflow: workflow.id, edge: e.id, target: e.target })
    return target && walk(workflow, target, multi ? out[e.sourceHandle] : out, run)
  }))
}

// Runs every trigger of this workflow that listens to the event, and resolves with their runs once they have all
// finished: { error, last } where last is the data of the last node that ran. parent ({ signal, depth }) is the
// firing that called this workflow (Execute Workflow): cancelling it cancels this one too.
export function fire(workflow, event, data, parent = {}) {
  return Promise.all(workflow.nodes.filter((n) => nodes[n.data.type]?.event === event).map(async (t) => {
    const controller = new AbortController()
    parent.signal?.addEventListener('abort', () => controller.abort(), { once: true })
    const firing = (runs[workflow.id] ??= new Set())
    const count = () => activity.emit('activity', { workflow: workflow.id, running: firing.size })
    const record = { id: ++lastRun, workflow: workflow.id, name: workflow.name, event, at: new Date().toISOString(), status: 'running', nodes: [] }
    // A firing counts as running once its trigger matched: most chat messages match no trigger.
    const start = () => {
      count(firing.add(controller))
      history.unshift(record)
      history.splice(100)
    }
    // outputs: node type or id -> output of the last node of that type that ran, for {{ $node... }}.
    const run = { signal: controller.signal, joins: {}, outputs: {}, depth: parent.depth ?? 0, record, start }
    const began = Date.now()
    try {
      await walk(workflow, t, data, run)
    } catch (err) {
      run.error = err
      console.error(`[${workflow.name}]`, err)
      // Error Trigger workflows hear about it, unless this one is such a workflow (so an error there can't loop).
      if (!workflow.nodes.some((n) => nodes[n.data.type]?.event === 'workflow-error')) {
        bus.emit('workflow-error', { workflow: workflow.name, node: run.failedNode, error: err.message })
      }
    } finally {
      firing.delete(controller) && count()
      record.status = run.error ? 'error' : run.signal.aborted ? 'stopped' : 'done'
      record.ms = Date.now() - began
    }
    return run
  }))
}

// Workflow id -> number of firings in progress, for clients that connect while some run.
export const running = () => Object.fromEntries(Object.entries(runs).filter(([, set]) => set.size).map(([id, set]) => [id, set.size]))

// Stops a workflow's firings in progress (e.g. when it's switched off): nodes waiting (delay, widget, queue) give up,
// and nothing after them runs.
export function cancel(workflowId) {
  for (const controller of runs[workflowId] ?? []) controller.abort()
}

// Workflows are re-read on each event so edits apply without a restart. Workflows switched off are skipped
// (the Run button still fires a switched-off workflow's manual triggers, through fire()).
for (const event of new Set(Object.values(nodes).map((d) => d.event).filter(Boolean))) {
  bus.on(event, async (data) => {
    for (const workflow of await store.list('workflows')) {
      if (workflow.enabled !== false) fire(workflow, event, data)
    }
  })
}

// Schedule triggers decide themselves if they are due: once a second, every workflow that is on is asked.
setInterval(async () => {
  for (const workflow of await store.list('workflows')) {
    if (workflow.enabled !== false) fire(workflow, 'schedule', {})
  }
}, 1000)
