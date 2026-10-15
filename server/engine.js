// Workflow engine: on a bus event, runs every matching trigger and walks its edges.
import fs from 'node:fs/promises'
import bus from './bus.js'
import * as store from './store.js'

// Load every node type from ./nodes, keyed by type.
const dir = new URL('./nodes/', import.meta.url)
export const nodes = {}
for (const name of await fs.readdir(dir)) {
  const def = (await import(new URL(name, dir))).default
  nodes[def.type] = def
}

// Runs one node, then the nodes connected to its output. A null result stops the branch.
async function walk(workflow, node, data) {
  const def = nodes[node.data.type]
  const out = await def.run({ config: { ...def.config, ...node.data.config }, data })
  if (out == null) return
  const next = workflow.edges.filter((e) => e.source === node.id)
  await Promise.all(next.map((e) => {
    const target = workflow.nodes.find((n) => n.id === e.target)
    return target && walk(workflow, target, out)
  }))
}

// Workflows are re-read on each event so edits apply without a restart.
for (const event of new Set(Object.values(nodes).map((d) => d.event).filter(Boolean))) {
  bus.on(event, async (data) => {
    for (const workflow of await store.list('workflows')) {
      const triggers = workflow.nodes.filter((n) => nodes[n.data.type]?.event === event)
      for (const t of triggers) walk(workflow, t, data).catch((err) => console.error(`[${workflow.name}]`, err))
    }
  })
}
