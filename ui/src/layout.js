// One-shot left-to-right layout: each node goes in the column of its longest path from a root (a node with no input),
// and each column is ordered by where its links come from, to keep crossings down. Widget nodes (no flow links)
// go in a row under the graph, each below the first Fire Widget node it drives (or the next free spot right). Returns { id: { x, y } }.
const COLUMN = 240 // node box (90px) plus its caption (160px wide), with room for links
const ROW = 160 // node box plus its two caption lines

// defs: node types, for the output order of if/else and switch (their "true" branch goes above "false").
export default function layout(all, links, defs) {
  const nodes = all.filter((n) => n.data.type !== 'widget')
  const edges = links.filter((e) => e.sourceHandle !== 'widget')
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
  // A widget whose spot is taken moves right, so links don't run behind other widgets. Widgets of the lowest nodes
  // go first: a link from a node higher up then runs beside the nodes under it, not through them.
  const bottom = Math.max(0, ...Object.values(positions).map((p) => p.y)) + ROW
  const driven = (w) => positions[links.find((e) => e.source === w.id && e.sourceHandle === 'widget')?.target]
  const taken = new Set()
  for (const w of all.filter((n) => n.data.type === 'widget').sort((a, b) => (driven(b)?.y ?? 0) - (driven(a)?.y ?? 0))) {
    let x = driven(w)?.x ?? 0
    while (taken.has(x)) x += COLUMN
    taken.add(x)
    positions[w.id] = { x, y: bottom }
  }
  return positions
}
