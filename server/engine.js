// Workflow engine: on a bus event (or a schedule tick), runs every matching trigger and walks its edges.
import fs from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import bus from './bus.js'
import * as store from './store.js'
import { iconNode } from './icons.js'

// Load every node type from ./nodes, keyed by type, in the library's order: most used first, a group's nodes together.
// Types not listed go last.
const order = [
  'manual', 'chat-command', 'chat-message',
  'redeem', 'follow', 'subscription', 'raid', 'cheer', 'gift-subs', 'hype-train', 'stream-status',
  'schedule', 'webhook', 'deck', 'workflow-call', 'error-trigger',
  'if-else', 'filter', 'switch', 'fan-out', 'fan-in', 'wait-all', 'execute-workflow',
  'delay', 'cooldown', 'queue',
  'edit-variable', 'code', 'edit-data',
  'twitch-chat', 'twitch-announce', 'twitch-shoutout', 'twitch-ban', 'twitch-delete-message', 'twitch-clip', 'twitch-user', 'twitch-channel-info',
  'twitch-redemption', 'twitch-marker', 'twitch-stream-info', 'twitch-ad', 'twitch-chat-mode', 'twitch-reward', 'twitch-raid',
  'obs-scene', 'obs-source', 'giphy', 'myinstants', 'hue',
  'widget-action', 'log', 'http-request', 'key-press', 'websocket-send',
]
const rank = (type) => (order.includes(type) ? order.indexOf(type) : order.length)
const dir = new URL('./nodes/', import.meta.url)
const loaded = await Promise.all((await fs.readdir(dir)).map(async (name) => (await import(new URL(name, dir))).default))
export const nodes = {}
for (const def of loaded.sort((a, b) => rank(a.type) - rank(b.type))) nodes[def.type] = { ...def, iconNode: await iconNode(def.icon) }

// Live run feedback for the editor (GET /api/activity): { workflow, node, state } where state is running, done,
// stopped (returned nothing), error or waiting (a join waiting for its other links), { workflow, edge, target }
// when data travels along a link, and { workflow, running } with the number of firings in progress.
export const activity = new EventEmitter()

// Queue nodes (`queue`): node key -> { busy: a firing is past the node, line: firings waiting, in order, as
// { id, at, data, go } where go(true) lets one through and go(false) drops it }.
const queues = {}
let lastEntry = 0
// Wait For All nodes (`join`): node key -> { arrived: { [link id]: data }, waiting: resolves of the firings waiting
// there }. It waits across firings (e.g. two triggers), until every incoming link has delivered once.
const joins = {}
// Node key -> how many firings are running it: a node only shows as finished once the last one has.
const active = {}
// Workflow id -> abort controllers of its firings in progress, for cancel().
const runs = {}

// The last 100 firings that matched a trigger, newest first (GET /api/runs); in memory only. Each is
// { id, workflow, name, event, at, ms, status: running | done | stopped | error, nodes: [{ node, type, input, output,
// error, ms }] }, one entry per node that ran: output null means it stopped the branch.
export const history = []
let lastRun = 0

// Runs one node, then the nodes connected to its outputs. A null result stops the branch.
// `run` is the state of one trigger firing: its abort signal, the node outputs so far, its history record.
// `from` is the node the data came from, { type, config, edge }: a widget node runs the action of a Widget Action node.
async function walk(workflow, node, data, run, from) {
  if (run.signal.aborted) return
  const def = nodes[node.data.type]
  const status = (state, extra) => activity.emit('activity', { workflow: workflow.id, node: node.id, state, ...extra })
  // `id` keys a node's memory across firings (cooldown).
  const id = `${workflow.id}/${node.id}`
  // A join holds each firing that arrives before every link has delivered; the last one to complete it continues, with
  // all the data merged, and the ones waiting end there.
  if (def.join) {
    const j = (joins[id] ??= { arrived: {}, waiting: [] })
    j.arrived[from.edge] = data
    if (workflow.edges.some((e) => e.target === node.id && !(e.id in j.arrived))) {
      status('waiting')
      data = await new Promise((resolve) => j.waiting.push(resolve))
      if (!data) return
    } else data = release(id, false)
  }
  const config = { ...def.config, ...node.data.config }
  // A queue node lets one firing at a time through: the next waits until everything after it has finished.
  if (def.queue) {
    const q = (queues[id] ??= { busy: false, line: [] })
    if (q.busy) {
      if (config.max > 0 && q.line.length >= config.max) return status('stopped') // line full: dropped
      status('waiting')
      const go = await new Promise((resolve) => q.line.push({ id: ++lastEntry, at: Date.now(), data, go: resolve }))
      if (!go) return status('stopped') // removed from the line (Queue settings)
    }
    q.busy = true
    try {
      if (run.signal.aborted) return status('stopped')
      return await step(workflow, node, data, run, { def, config, id, status, from })
    } finally {
      const next = q.line.shift()
      if (next) next.go(true) // its turn: the node stays busy
      else q.busy = false
    }
  }
  return step(workflow, node, data, run, { def, config, id, status, from })
}

// The firings waiting at a queue node, first in line first: [{ id, at, data }] (GET /api/queues/:workflow/:node).
export const line = (workflow, node) => (queues[`${workflow}/${node}`]?.line ?? []).map(({ id, at, data }) => ({ id, at, data }))

// Removes a firing from a queue node's line: it stops there (DELETE /api/queues/:workflow/:node/:entry).
export function drop(workflow, node, entry) {
  const q = queues[`${workflow}/${node}`]
  const i = q?.line.findIndex((e) => e.id === entry) ?? -1
  if (i >= 0) q.line.splice(i, 1)[0].go(false)
  return i >= 0
}

// Ends the wait at a Wait For All node and returns the data that arrived, merged. The firings waiting there end, but
// with go the last one to arrive continues with that data (Force).
function release(key, go) {
  const j = joins[key]
  delete joins[key]
  const data = Object.assign({}, ...Object.values(j.arrived))
  j.waiting.forEach((resolve, i) => resolve(go && i === j.waiting.length - 1 ? data : null))
  return data
}

// The links that have delivered to a Wait For All node, as link ids (GET /api/joins/:workflow/:node).
export const arrived = (workflow, node) => Object.keys(joins[`${workflow}/${node}`]?.arrived ?? {})

// Ends the wait at a Wait For All node: Force continues now with what arrived, Cancel drops it (the firings stop there).
export function unjoin(workflow, node, go) {
  const key = `${workflow}/${node}`
  if (!joins[key]) return false
  release(key, go)
  if (!go) activity.emit('activity', { workflow, node, state: 'stopped' })
  return true
}

// Runs the node itself, then walks on from its outputs. Besides the data, the node can read {{ $node.<type>.<key> }},
// the output of an earlier node in this firing: data is copied with it attached out of sight (not enumerable), so
// it doesn't travel on with the data.
async function step(workflow, node, data, run, { def, config, id, status, from }) {
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
  // A failure stops the firing there.
  let out
  try {
    out = await def.run({ config, data, id, from, signal: run.signal, depth: run.depth, origins: run.origins, event: run.event })
  } catch (err) {
    if (run.signal.aborted) return end('stopped') // e.g. an HTTP request cut short by cancel()
    log({ error: err.message })
    run.failedNode = def.label
    end('error', { error: err.message })
    throw err
  }
  if (out == null || run.signal.aborted) {
    if (!trigger) log({ output: null })
    return end('stopped')
  }
  if (trigger) run.start()
  log({ output: out })
  end('done')
  // Nodes with several outputs (if/else, switch) return { [output]: data }; only those outputs continue. A split node
  // (Fan Out) returns a list: each item continues on its own, in order.
  const multi = def.outputs || def.outputsFrom
  const items = def.split ? out : [out]
  run.last = multi ? Object.values(out)[0] : items.at(-1)
  run.outputs[def.type] = run.outputs[node.id] = run.last
  const next = workflow.edges.filter((e) => e.source === node.id && (!multi || e.sourceHandle in out))
  await Promise.all(next.flatMap((e) => {
    const target = workflow.nodes.find((n) => n.id === e.target)
    if (target) activity.emit('activity', { workflow: workflow.id, edge: e.id, target: e.target })
    return target ? items.map((item) => walk(workflow, target, multi ? out[e.sourceHandle] : item, run, { type: def.type, config, edge: e.id })) : []
  }))
}

// Whether a node type's trigger listens to the event: its `event` is one name or a list.
const listens = (def, event) => [def?.event].flat().includes(event)

// Runs every trigger of this workflow that listens to the event, and resolves with their runs once they have all
// finished: { error, last } where last is the data of the last node that ran. parent ({ signal, depth, origins }) is the
// firing that called this workflow (Execute Workflow): cancelling it cancels this one too. only: a trigger node id to
// run alone.
export function fire(workflow, event, data, parent = {}, only) {
  return Promise.all(workflow.nodes.filter((n) => (!only || n.id === only) && listens(nodes[n.data.type], event)).map(async (t) => {
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
    // outputs: node type or id -> output of the last node of that type that ran, for {{ $node... }}. origins: the
    // triggers this firing comes from, as `workflow/node` keys: its own, after those of the firings that called it.
    const run = { event, signal: controller.signal, outputs: {}, depth: parent.depth ?? 0, record, start,
      origins: [...(parent.origins ?? []), `${workflow.id}/${t.id}`] }
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

// Stops a workflow's firings in progress (e.g. when it's switched off): nodes waiting (delay, widget, queue, wait for
// all) give up, and nothing after them runs.
export function cancel(workflowId) {
  for (const controller of runs[workflowId] ?? []) controller.abort()
  for (const key in joins) if (key.startsWith(`${workflowId}/`)) unjoin(workflowId, key.slice(workflowId.length + 1), false)
}

// Workflows are re-read on each event so edits apply without a restart. Workflows switched off are skipped
// (the Run button still fires a switched-off workflow's manual triggers, through fire()).
for (const event of new Set(Object.values(nodes).flatMap((d) => [d.event ?? []].flat()))) {
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
