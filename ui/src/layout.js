// One-shot left-to-right layout: each node goes in the column of its longest path from a root (a node with no input),
// and each column is ordered by where its links come from, to keep crossings down. Each node sits level with the
// output it comes from (so a chain of links is straight), pushed down only as much as needed for the nodes above it,
// by their real height (a switch grows with its cases). Returns { id: { x, y } }.
import { nodeHeight, outputsOf } from './FlowNode.jsx'

const COLUMN = 240 // node box (90px) plus its caption (160px wide), with room for links
const CAPTION = 50 // the two caption lines under a node
const GAP = 20 // between a caption and the next node

// defs: node types, for node heights and output order (if/else's "true" goes above "false", a switch's cases in order).
export default function layout(nodes, edges, defs) {
  const def = (n) => defs.find((d) => d.type === n?.data.type)
  const height = (n) => nodeHeight(def(n), n.data.config, edges.filter((e) => e.target === n.id).length)
  // Longest path from a root; relaxing at most once per node also stops on a loop.
  const depth = Object.fromEntries(nodes.map((n) => [n.id, 0]))
  for (let i = 0; i < nodes.length; i++) {
    for (const e of edges) {
      if (depth[e.target] <= depth[e.source] && depth[e.source] < nodes.length) depth[e.target] = depth[e.source] + 1
    }
  }

  // Columns left to right; a node's rank is the average height of the outputs it is linked from: where its input
  // (its middle) would like to be.
  const positions = {}
  const outputY = (e) => {
    const source = nodes.find((p) => p.id === e.source)
    const outputs = outputsOf(def(source), source.data.config).map((o) => o.id)
    const share = outputs.length ? (outputs.indexOf(e.sourceHandle) + 1) / (outputs.length + 1) : 0.5
    return positions[e.source].y + share * height(source)
  }
  const columns = Math.max(0, ...Object.values(depth)) + 1
  for (let c = 0; c < columns; c++) {
    const column = nodes.filter((n) => depth[n.id] === c)
    const rank = (n) => {
      const parents = edges.filter((e) => e.target === n.id && e.source in positions)
      if (!parents.length) return null
      return parents.reduce((sum, e) => sum + outputY(e), 0) / parents.length
    }
    const wanted = Object.fromEntries(column.map((n) => [n.id, rank(n)]))
    // Roots keep their current top-to-bottom order and are stacked around y = 0; the others go where they want.
    const roots = column.filter((n) => wanted[n.id] === null).sort((a, b) => a.position.y - b.position.y)
    let y = -roots.reduce((sum, n) => sum + height(n) + CAPTION + GAP, -GAP) / 2
    for (const n of roots) {
      wanted[n.id] = y + height(n) / 2
      y += height(n) + CAPTION + GAP
    }
    column.sort((a, b) => wanted[a.id] - wanted[b.id])
    // Top to bottom, each node at its wanted spot or just under the one above (its caption and a gap). Then the whole
    // column moves back up by the average push, so nodes pushed apart spread evenly around their links.
    let free = -Infinity
    for (const n of column) {
      const top = Math.max(wanted[n.id] - height(n) / 2, free)
      positions[n.id] = { x: c * COLUMN, y: top }
      free = top + height(n) + CAPTION + GAP
    }
    const push = column.reduce((sum, n) => sum + positions[n.id].y + height(n) / 2 - wanted[n.id], 0) / column.length
    for (const n of column) positions[n.id].y -= push
  }
  return positions
}
