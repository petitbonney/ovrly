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
// stopped (returned nothing), error or waiting (a join waiting for its other links), and { workflow, edge, target }
// when data travels along a link.
export const activity = new EventEmitter()

// Runs one node, then the nodes connected to its outputs. A null result stops the branch.
// `run` is the state of one trigger firing: the data waiting at "wait for all" (join) nodes.
async function walk(workflow, node, data, run) {
  const def = nodes[node.data.type]
  const status = (state, extra) => activity.emit('activity', { workflow: workflow.id, node: node.id, state, ...extra })
  if (def.join) {
    const arrived = (run[node.id] ??= [])
    arrived.push(data)
    if (arrived.length < workflow.edges.filter((e) => e.target === node.id).length) return status('waiting')
    data = Object.assign({}, ...arrived)
  }
  // A trigger is only shown when it fires: most chat messages don't match most triggers.
  const trigger = def.category === 'trigger'
  if (!trigger) status('running')
  let out
  try {
    out = await def.run({ config: { ...def.config, ...node.data.config }, data })
  } catch (err) {
    status('error', { error: err.message })
    throw err
  }
  if (out == null) {
    if (!trigger) status('stopped')
    return
  }
  status('done')
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
    walk(workflow, t, data, {}).catch((err) => console.error(`[${workflow.name}]`, err))
  }
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
