// One-shot left-to-right layout: each node goes in the column of its longest path from a root (a node with no input),
// and each column is ordered by where its links come from, to keep crossings down. Each node sits level with the
// output it comes from (so a chain of links is straight), pushed down only as much as needed for the nodes above it,
// by their real height (a switch grows with its cases); links skipping columns get nodes out of their way. Returns { id: { x, y } }.
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

  // A link spanning several columns gets an invisible point (height 0) in each column it crosses, so nodes there
  // make way for it instead of sitting on top of it. Links to an earlier column (loops) are left out.
  const segs = []
  edges.forEach((e, i) => {
    let from = e.source
    for (let c = depth[e.source] + 1; c < depth[e.target]; c++) {
      depth[`${i}:${c}`] = c
      segs.push({ source: from, sourceHandle: from === e.source ? e.sourceHandle : null, target: `${i}:${c}` })
      from = `${i}:${c}`
    }
    segs.push({ source: from, sourceHandle: from === e.source ? e.sourceHandle : null, target: e.target })
  })
  const items = [...nodes.map((n) => ({ id: n.id, node: n })), ...Object.keys(depth).filter((id) => id.includes(':')).map((id) => ({ id }))]
  const high = (it) => (it.node ? height(it.node) : 0)
  const caption = (it) => (it.node ? CAPTION : 0)

  // Columns left to right; a node's rank is the average height of the outputs it is linked from: where its input
  // (its middle) would like to be.
  const positions = {}
  const outputY = (e) => {
    const source = nodes.find((p) => p.id === e.source)
    if (!source) return positions[e.source].y
    const outputs = outputsOf(def(source), source.data.config).map((o) => o.id)
    const share = outputs.length ? (outputs.indexOf(e.sourceHandle) + 1) / (outputs.length + 1) : 0.5
    return positions[e.source].y + share * height(source)
  }
  const columns = Math.max(0, ...Object.values(depth)) + 1
  for (let c = 0; c < columns; c++) {
    const column = items.filter((it) => depth[it.id] === c)
    const rank = (it) => {
      const parents = segs.filter((e) => e.target === it.id && e.source in positions)
      if (!parents.length) return null
      return parents.reduce((sum, e) => sum + outputY(e), 0) / parents.length
    }
    const wanted = Object.fromEntries(column.map((it) => [it.id, rank(it)]))
    // Roots keep their current top-to-bottom order and are stacked around y = 0; the others go where they want.
    const roots = column.filter((it) => wanted[it.id] === null).sort((a, b) => a.node.position.y - b.node.position.y)
    let y = -roots.reduce((sum, it) => sum + high(it) + CAPTION + GAP, -GAP) / 2
    for (const it of roots) {
      wanted[it.id] = y + high(it) / 2
      y += high(it) + CAPTION + GAP
    }
    // On a tie, a node with nothing after it goes above the ones that carry on (their links head down or up).
    const leaf = (it) => !segs.some((e) => e.source === it.id)
    column.sort((a, b) => wanted[a.id] - wanted[b.id] || leaf(b) - leaf(a))
    // Top to bottom, each item at its wanted spot or just under the one above (its caption and a gap). Then the whole
    // column moves back up by the average push, so nodes pushed apart spread evenly around their links.
    let free = -Infinity
    for (const it of column) {
      const top = Math.max(wanted[it.id] - high(it) / 2, free)
      positions[it.id] = { x: c * COLUMN, y: top }
      free = top + high(it) + caption(it) + GAP
    }
    const push = column.reduce((sum, it) => sum + positions[it.id].y + high(it) / 2 - wanted[it.id], 0) / column.length
    for (const it of column) positions[it.id].y -= push
  }
  for (const id of Object.keys(positions)) if (id.includes(':')) delete positions[id]
  return positions
}
