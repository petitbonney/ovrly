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
  // Merge Widgets: a canvas width and height, with boxes in its pixels from the top left, became fractions of the
  // canvas from its center. Boxes are kept inside the canvas.
  merge: ({ width, height, layout = {}, ...config }) => width !== undefined && {
    ...config,
    layout: Object.fromEntries(Object.entries(layout).map(([id, b]) => {
      const w = Math.min(Math.abs(b.w) / width, 1)
      const h = Math.min(Math.abs(b.h) / height, 1)
      const x = Math.min(Math.max((b.x + b.w / 2) / width - 0.5, w / 2 - 0.5), 0.5 - w / 2)
      const y = Math.min(Math.max((b.y + b.h / 2) / height - 0.5, h / 2 - 0.5), 0.5 - h / 2)
      return [id, { x, y, w, h }]
    })),
  },
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

// Version 3: the OBS connection moved from each OBS node to the OBS integration (sidebar), and the scene, which
// defaulted to "Scene", is now picked from OBS (empty by default): nodes that relied on the old default keep it.
function upgradeObs(workflow) {
  if (workflow.version >= 3) return workflow
  const nodes = workflow.nodes?.map((n) => {
    if (!n.data.type.startsWith('obs-')) return n
    const { url, password, ...config } = n.data.config ?? {}
    return { ...n, data: { ...n.data, config: { ...config, scene: config.scene ?? 'Scene' } } }
  })
  return { ...workflow, version: 3, nodes }
}

export default function upgrade(old) {
  const workflow = upgradeObs(upgradePlaceholders(old))
  let changed = false
  const nodes = workflow.nodes?.map((n) => {
    const config = settings[n.data.type]?.(n.data.config ?? {})
    if (!config) return n
    changed = true
    return { ...n, data: { ...n.data, config } }
  })
  return upgradeFireWidget(upgradeWidgetNodes(changed ? { ...workflow, nodes } : workflow))
}

// Widgets used to run inside the flow ("widget-update" nodes, and "event-bus" nodes that sent actions to any widget):
// each becomes a Widget Callback node (same id, links and action), plus one widget node per instance, placed below.
const OLD = ['widget-update', 'event-bus']

function upgradeWidgetNodes(workflow) {
  if (!workflow.nodes?.some((n) => OLD.includes(n.data.type))) return workflow
  const nodes = []
  const placed = new Set() // instances that have their widget node
  for (const n of workflow.nodes) {
    if (!OLD.includes(n.data.type)) {
      nodes.push(n)
      continue
    }
    nodes.push({ ...n, data: { ...n.data, type: 'widget-callback', label: 'Widget Callback' } })
    const { widget } = n.data.config
    if (!widget || placed.has(widget)) continue
    placed.add(widget)
    nodes.push({ id: `${n.id}-widget`, type: n.type, position: { x: n.position.x, y: n.position.y + 200 }, data: { type: 'widget', label: 'Widget', config: { widget } } })
  }
  return { ...workflow, nodes }
}

// Fire Widget nodes ran actions on the widget nodes linked to their diamond connector; widget nodes now run their main
// action themselves. Each Fire Widget node becomes a Widget Callback node per linked widget, with that widget's action
// and value: several run side by side and meet at a Wait For All node (with the Fire Widget node's id), as before.
// Widget nodes stay, unlinked.
function upgradeFireWidget(workflow) {
  if (!workflow.nodes?.some((n) => n.data.type === 'fire-widget')) return workflow
  const links = workflow.edges.filter((e) => e.sourceHandle === 'widget')
  let edges = workflow.edges.filter((e) => e.sourceHandle !== 'widget')
  const nodes = workflow.nodes.flatMap((n) => {
    if (n.data.type !== 'fire-widget') return [n]
    const { widgets, action, value, ...config } = n.data.config
    const refs = links.filter((e) => e.target === n.id).map((e) => workflow.nodes.find((w) => w.id === e.source)?.data.config.widget).filter(Boolean)
    const callback = (id, widget, i) => {
      const own = widgets?.[widget] ?? { action, value }
      const position = { x: n.position.x, y: n.position.y + i * 140 }
      return { ...n, id, position, data: { type: 'widget-callback', label: 'Widget Callback', config: { ...config, widget, action: own.action ?? '', value: own.value ?? '' } } }
    }
    if (refs.length <= 1) return [callback(n.id, refs[0] ?? '', 0)]
    const ids = refs.map((r, i) => `${n.id}-${i}`)
    const into = edges.filter((e) => e.target === n.id)
    edges = edges.filter((e) => e.target !== n.id).concat(
      ids.flatMap((id) => into.map((e) => ({ ...e, id: `${e.id}-${id}`, target: id }))),
      ids.map((id) => ({ id: `${id}-join`, source: id, target: n.id })),
    )
    const join = { ...n, position: { x: n.position.x + 240, y: n.position.y }, data: { type: 'wait-all', label: 'Wait For All', config: {} } }
    return [...refs.map((r, i) => callback(ids[i], r, i)), join]
  })
  return { ...workflow, nodes, edges }
}

// Widget settings that are now lists used to be comma-separated text: "Yes, No" becomes ['Yes', 'No'], or, when the
// type's list holds objects (the wheel's { label, color, weight }), items copied from its defaults with that label.
// The Spin Wheel became the Lottery, whose wheel is one layout; its pointer color setting is gone. The lottery's coin
// flip layout is gone too: it falls back to the wheel.
export function upgradeWidget(widget, types) {
  if (widget.type === 'wheel') {
    const { pointerColor, ...config } = widget.config ?? {}
    widget = { ...widget, type: 'lottery', config: { ...config, layout: 'wheel' } }
  }
  if (widget.type === 'lottery' && 'coin' in (widget.config ?? {})) {
    const { coin, ...config } = widget.config
    widget = { ...widget, config: { ...config, ...(config.layout === 'coin' && { layout: 'wheel' }) } }
  }
  const defaults = types[widget.type]?.config
  if (!defaults) return widget
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
