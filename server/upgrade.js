// Brings workflows and widgets saved by older versions up to date; applied at startup and to every item saved or
// imported.
// Widgets used to run inside the flow ("widget-update" nodes, and "event-bus" nodes that sent actions to any widget):
// each becomes a Fire Widget node (same id, links and action) linked to one widget node per instance, placed below.
const OLD = ['widget-update', 'event-bus']

export default function upgrade(workflow) {
  if (!workflow.nodes?.some((n) => OLD.includes(n.data.type))) return workflow
  const nodes = []
  const edges = [...(workflow.edges ?? [])]
  const widgetNodes = {} // instance id -> its widget node id
  for (const n of workflow.nodes) {
    if (!OLD.includes(n.data.type)) {
      nodes.push(n)
      continue
    }
    const { widget, ...config } = n.data.config
    nodes.push({ ...n, data: { ...n.data, type: 'fire-widget', label: 'Fire Widget', config } })
    if (!widget) continue
    if (!widgetNodes[widget]) {
      widgetNodes[widget] = `${n.id}-widget`
      const position = { x: n.position.x, y: n.position.y + 200 }
      nodes.push({ id: widgetNodes[widget], type: n.type, position, data: { type: 'widget', label: 'Widget', config: { widget } } })
    }
    edges.push({ id: `${widgetNodes[widget]}-${n.id}`, source: widgetNodes[widget], sourceHandle: 'widget', target: n.id, targetHandle: 'widget' })
  }
  return { ...workflow, nodes, edges }
}

// Widget settings that are now lists used to be comma-separated text: "Yes, No" becomes ['Yes', 'No'], or, when the
// type's list holds objects (the wheel's { label, color, weight }), items copied from its defaults with that label.
export function upgradeWidget(widget, defaults) {
  const old = Object.keys(widget.config ?? {}).filter((k) => Array.isArray(defaults[k]) && typeof widget.config[k] === 'string')
  if (!old.length) return widget
  const config = { ...widget.config }
  for (const key of old) {
    const items = defaults[key]
    const labels = config[key].split(',').map((s) => s.trim()).filter(Boolean)
    config[key] = labels.map((label, i) => (typeof items[0] === 'object' ? { ...items[i % items.length], label } : label))
  }
  return { ...widget, config }
}
