// Workflow engine: on a bus event, runs every matching trigger and walks its edges.
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

// Runs one node, then the nodes connected to its outputs. A null result stops the branch.
// `run` is the state of one trigger firing: its abort signal and the data waiting at "wait for all" (join) nodes.
async function walk(workflow, node, data, run) {
  if (run.signal.aborted) return
  const def = nodes[node.data.type]
  const status = (state, extra) => activity.emit('activity', { workflow: workflow.id, node: node.id, state, ...extra })
  if (def.join) {
    const arrived = (run.joins[node.id] ??= [])
    arrived.push(data)
    if (arrived.length < workflow.edges.filter((e) => e.target === node.id).length) return status('waiting')
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

// Runs the node itself, then walks on from its outputs.
async function step(workflow, node, data, run, { def, config, id, status }) {
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
  let out
  try {
    out = await def.run({ config, data, id, signal: run.signal })
  } catch (err) {
    if (run.signal.aborted) return end('stopped') // e.g. an HTTP request cut short by cancel()
    end('error', { error: err.message })
    throw err
  }
  if (out == null || run.signal.aborted) return end('stopped')
  if (trigger) run.start()
  end('done')
  // Nodes with several outputs (if/else, switch) return { [output]: data }; only those outputs continue.
  const next = workflow.edges.filter((e) => e.source === node.id && (!def.outputs || e.sourceHandle in out))
  await Promise.all(next.map((e) => {
    const target = workflow.nodes.find((n) => n.id === e.target)
    if (target) activity.emit('activity', { workflow: workflow.id, edge: e.id, target: e.target })
    return target && walk(workflow, target, def.outputs ? out[e.sourceHandle] : out, run)
  }))
}

// Runs every trigger of this workflow that listens to the event.
export function fire(workflow, event, data) {
  for (const t of workflow.nodes.filter((n) => nodes[n.data.type]?.event === event)) {
    const controller = new AbortController()
    const firing = (runs[workflow.id] ??= new Set())
    const count = () => activity.emit('activity', { workflow: workflow.id, running: firing.size })
    // A firing counts as running once its trigger matched: most chat messages match no trigger.
    const start = () => count(firing.add(controller))
    walk(workflow, t, data, { signal: controller.signal, joins: {}, start })
      .catch((err) => console.error(`[${workflow.name}]`, err))
      .finally(() => firing.delete(controller) && count())
  }
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
