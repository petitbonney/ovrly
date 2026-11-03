// One-shot left-to-right layout: each node goes in the column of its longest path from a root (a node with no input),
// and each column is ordered by where its links come from, to keep crossings down. Each node sits level with the
// output it comes from (so a chain of links is straight), pushed down only as much as needed for the nodes above it,
// by their real height (a switch grows with its cases); links skipping columns get nodes out of their way. Positions
// are on the grid, so those straight links stay straight once snapped. Returns { id: { x, y } }.
import { NODE, PORT, nodeHeight, outputsOf, portSlots, portY, slotCount } from './FlowNode.jsx'

// Spacing shared with the editor (Workflow.jsx: snapping, new nodes, the Basic view's line).
export const GRID = 10 // nodes snap to it; every port is on one of its lines (see portY)
export const CAPTION = 50 // the two caption lines under a node
const GAP = 30 // between a caption and the next node: 80px between node boxes, across and down
export const STEP = NODE + CAPTION + GAP // from a node to the next one, across (a column) and down
const onGrid = (v) => Math.round(v / GRID) * GRID
// Of several heights, their average, or the one nearest it when that is close: a link made straight by a small move,
// without leaving a fan of links lopsided for it.
function settle(heights) {
  const average = heights.reduce((sum, y) => sum + y, 0) / heights.length
  const nearest = heights.reduce((best, y) => (Math.abs(y - average) < Math.abs(best - average) ? y : best))
  return Math.abs(nearest - average) <= PORT ? nearest : average
}

// defs: node types, for node heights and output order (if/else's "true" goes above "false", a switch's cases in order).
export default function layout(nodes, edges, defs) {
  const def = (n) => defs.find((d) => d.type === n?.data.type)
  // A widget node's ports, with one slot per link into each (see portSlots).
  const slots = (n) => {
    const counts = edges.filter((e) => e.target === n.id).reduce((c, e) => ({ ...c, [e.targetHandle ?? '']: (c[e.targetHandle ?? ''] ?? 0) + 1 }), {})
    return portSlots([null, ...(n.data.config.ports ?? [])], counts)
  }
  const inputs = (n) => (n.data.type === 'widget' ? slotCount(slots(n)) : edges.filter((e) => e.target === n.id).length)
  const height = (n) => nodeHeight(def(n), n.data.config, inputs(n))
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
    segs.push({ source: from, sourceHandle: from === e.source ? e.sourceHandle : null, target: e.target, targetHandle: e.targetHandle })
  })
  const items = [...nodes.map((n) => ({ id: n.id, node: n })), ...Object.keys(depth).filter((id) => id.includes(':')).map((id) => ({ id }))]
  const high = (it) => (it.node ? height(it.node) : 0)
  const caption = (it) => (it.node ? CAPTION : 0)

  // Columns left to right; a node's rank is where its middle would like to be: level with the outputs it is linked
  // from, for each link's end (a widget node's port, else its middle; links into several slots of a port or node even
  // out around it), averaged and settled over its links.
  const positions = {}
  const outputY = (e) => {
    const source = nodes.find((p) => p.id === e.source)
    if (!source) return positions[e.source].y
    const outputs = outputsOf(def(source), source.data.config).map((o) => o.id)
    return positions[e.source].y + height(source) / 2 + (outputs.length ? portY(outputs.indexOf(e.sourceHandle), outputs.length) : 0)
  }
  const inputY = (e) => {
    const target = nodes.find((n) => n.id === e.target)
    if (target?.data.type !== 'widget') return 0
    const ports = slots(target)
    const port = ports.find((p) => p.id === (e.targetHandle ?? null)) ?? ports[0]
    return portY(port.first + (port.slots - 1) / 2, slotCount(ports))
  }
  const columns = Math.max(0, ...Object.values(depth)) + 1
  // A column with labelled outputs (several on a node) before one with labelled ports (a widget node's, past its main
  // one) gets twice the gap, so the labels at both ends of a link don't overlap.
  const some = (c, test) => nodes.some((n) => depth[n.id] === c && test(n))
  const xs = [0]
  for (let c = 1; c < columns; c++) {
    const wide = some(c - 1, (n) => outputsOf(def(n), n.data.config).length > 1) && some(c, (n) => n.data.config.ports?.length > 0)
    xs[c] = xs[c - 1] + STEP + (wide ? NODE : 0)
  }
  // Places a column at x, each item's middle as near as it can to where it wants (wanted: id -> y).
  const place = (column, wanted, x) => {
    // On a tie, a node with nothing after it goes above the ones that carry on (their links head down or up).
    const leaf = (it) => !segs.some((e) => e.source === it.id)
    column.sort((a, b) => wanted[a.id] - wanted[b.id] || leaf(b) - leaf(a))
    // Top to bottom, each item at its wanted spot or just under the one above (its caption and a gap). Then the whole
    // column moves back up by the average push (settled), so nodes pushed apart spread evenly around their links.
    let free = -Infinity
    for (const it of column) {
      const top = Math.max(onGrid(wanted[it.id] - high(it) / 2), free)
      positions[it.id] = { x, y: top }
      free = top + high(it) + caption(it) + GAP
    }
    const push = onGrid(settle(column.map((it) => positions[it.id].y + high(it) / 2 - wanted[it.id])))
    for (const it of column) positions[it.id].y -= push
  }
  for (let c = 0; c < columns; c++) {
    const column = items.filter((it) => depth[it.id] === c)
    const rank = (it) => {
      const parents = segs.filter((e) => e.target === it.id && e.source in positions)
      if (!parents.length) return null
      return settle(parents.map((e) => outputY(e) - inputY(e)))
    }
    const wanted = Object.fromEntries(column.map((it) => [it.id, rank(it)]))
    // Roots keep their current top-to-bottom order and are stacked around y = 0; the others go where they want.
    const roots = column.filter((it) => wanted[it.id] === null).sort((a, b) => a.node.position.y - b.node.position.y)
    let y = onGrid(-roots.reduce((sum, it) => sum + high(it) + CAPTION + GAP, -GAP) / 2)
    for (const it of roots) {
      wanted[it.id] = y + high(it) / 2
      y += high(it) + CAPTION + GAP
    }
    place(column, wanted, xs[c])
  }
  // Then the roots move level with what they link to (the nodes after them may have been pushed apart), in the order
  // that gives (with several links, their average, settled).
  const roots = items.filter((it) => depth[it.id] === 0)
  const middle = (id) => positions[id].y + high(items.find((it) => it.id === id)) / 2
  place(roots, Object.fromEntries(roots.map((it) => {
    const levels = segs.filter((e) => e.source === it.id).map((e) => middle(e.target) + inputY(e) - (outputY(e) - middle(it.id)))
    return [it.id, levels.length ? settle(levels) : middle(it.id)]
  })), 0)
  for (const id of Object.keys(positions)) if (id.includes(':')) delete positions[id]
  return positions
}
