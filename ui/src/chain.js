// Basic view helpers: a workflow's nodes in order when its graph is one line (chainOf), and the links that make a
// list of nodes one line again (relink). Pure, so the node tests can import them.

// Node types the Basic view's library leaves out: they make branches or take several inputs.
export const graphOnly = ['if-else', 'switch', 'fan-out', 'fan-in', 'wait-all', 'merge']

// The nodes in order from the head, or null when the graph isn't one line: a node with several links in or out, a
// node off the line, a trigger after the head, a link from an output other than the node's first (If/else's
// "false", Cooldown's "blocked": the others just stop there), or one into a widget node's action port. Empty is a line.
// isTrigger(node); firstOutput(node): its first output's id, null for a node with one output, undefined for one with
// none (Portal Out not waiting): it can only end the line.
export function chainOf(nodes, edges, { isTrigger, firstOutput }) {
  const out = {}
  const into = {}
  for (const e of edges) {
    ;(out[e.source] ??= []).push(e)
    ;(into[e.target] ??= []).push(e)
  }
  if (nodes.some((n) => out[n.id]?.length > 1 || into[n.id]?.length > 1) || edges.some((e) => e.targetHandle)) return null
  const heads = nodes.filter((n) => !into[n.id])
  if (nodes.length && heads.length !== 1) return null
  const list = []
  for (let n = heads[0]; n;) {
    list.push(n)
    const e = out[n.id]?.[0]
    if (e && (e.sourceHandle ?? null) !== firstOutput(n)) return null
    n = e && nodes.find((m) => m.id === e.target)
  }
  return list.length === nodes.length && !list.slice(1).some(isTrigger) ? list : null
}

// The links of a list of nodes in that order, each from its node's first output; links already there are kept. A node
// without an output links to nothing (the line breaks there, so the graph is shown).
export function relink(list, edges, firstOutput) {
  return list.slice(1).flatMap((n, i) => (firstOutput(list[i]) === undefined ? [] : [edges.find((e) => e.source === list[i].id && e.target === n.id)
    ?? { id: crypto.randomUUID(), source: list[i].id, sourceHandle: firstOutput(list[i]), target: n.id, targetHandle: null }]))
}
