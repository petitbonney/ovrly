// One-shot left-to-right layout: each node goes in the column of its longest path from a root (a node with no input),
// and each column is ordered by where its links come from, to keep crossings down. Returns { id: { x, y } }.
const COLUMN = 240 // node box (90px) plus its caption (160px wide), with room for links
const ROW = 160 // node box plus its two caption lines

// defs: node types, for the output order of if/else and switch (their "true" branch goes above "false").
export default function layout(nodes, edges, defs) {
  // Longest path from a root; relaxing at most once per node also stops on a loop.
  const depth = Object.fromEntries(nodes.map((n) => [n.id, 0]))
  for (let i = 0; i < nodes.length; i++) {
    for (const e of edges) {
      if (depth[e.target] <= depth[e.source] && depth[e.source] < nodes.length) depth[e.target] = depth[e.source] + 1
    }
  }

  // Columns left to right; a node's rank is the average height of its parents, nudged by the output it comes from.
  const positions = {}
  const columns = Math.max(0, ...Object.values(depth)) + 1
  for (let c = 0; c < columns; c++) {
    const column = nodes.filter((n) => depth[n.id] === c)
    const rank = (n) => {
      const parents = edges.filter((e) => e.target === n.id && e.source in positions)
      if (!parents.length) return n.position.y // roots keep their current top-to-bottom order
      return parents.reduce((sum, e) => {
        const outputs = defs.find((d) => d.type === nodes.find((p) => p.id === e.source)?.data.type)?.outputs ?? []
        return sum + positions[e.source].y / ROW + (outputs.indexOf(e.sourceHandle) + 1) / (outputs.length + 1)
      }, 0) / parents.length
    }
    column.sort((a, b) => rank(a) - rank(b))
    column.forEach((n, i) => {
      positions[n.id] = { x: c * COLUMN, y: (i - (column.length - 1) / 2) * ROW } // each column centred on the same line
    })
  }
  return positions
}
