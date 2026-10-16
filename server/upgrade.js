// Brings workflows and widgets saved by older versions up to date; applied at startup and to every item saved or
// imported.

// Node settings that changed shape: each returns the new settings, or nothing if they are already up to date.
const settings = {
  // case1..case3 became a list (outputs keep their ids "1".."3").
  switch: ({ case1, case2, case3, ...config }) => config.cases === undefined && { ...config, cases: [case1 ?? '', case2 ?? '', case3 ?? ''] },
  // "data[field] contains text" became an if/else-like comparison.
  filter: ({ field, contains, ...config }) => field !== undefined && { ...config, value: `{{${field}}}`, operator: 'contains', compare: contains ?? '' },
  // ms became seconds.
  delay: ({ ms, ...config }) => ms !== undefined && { ...config, seconds: ms / 1000 },
}

// Placeholders were "{key}" until version 2, then "{{key}}". Done once (the version is saved), so a "{word}" typed
// later stays as it is.
const doubled = (value) => (typeof value === 'string' ? value.replace(/(?<!\{)\{(\w+)\}(?!\})/g, '{{$1}}')
  : Array.isArray(value) ? value.map(doubled) : value)
function upgradePlaceholders(workflow) {
  if (workflow.version >= 2) return workflow
  const nodes = workflow.nodes?.map((n) => {
    const config = Object.fromEntries(Object.entries(n.data.config ?? {}).map(([k, v]) => [k, doubled(v)]))
    return { ...n, data: { ...n.data, config } }
  })
  return { ...workflow, version: 2, nodes }
}

export default function upgrade(old) {
  const workflow = upgradePlaceholders(old)
  let changed = false
  const nodes = workflow.nodes?.map((n) => {
    const config = settings[n.data.type]?.(n.data.config ?? {})
    if (!config) return n
    changed = true
    return { ...n, data: { ...n.data, config } }
  })
  return upgradeWidgetNodes(changed ? { ...workflow, nodes } : workflow)
}

// Widgets used to run inside the flow ("widget-update" nodes, and "event-bus" nodes that sent actions to any widget):
// each becomes a Fire Widget node (same id, links and action) linked to one widget node per instance, placed below.
const OLD = ['widget-update', 'event-bus']

function upgradeWidgetNodes(workflow) {
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
