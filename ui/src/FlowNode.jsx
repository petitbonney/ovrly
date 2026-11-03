// n8n-style graph node: icon box with the label underneath; triggers get a rounded left side, and a bolt that fires
// them by hand (Bolt, also on Basic view cards) when their type can (its `manual`). A node whose needs aren't met (an
// integration not ready) gets a warning badge, one of a type that isn't loaded (a custom node or widget removed or
// broken) a red one. Nodes with several outputs (if/else, switch) get one labelled handle
// each, and grow taller with more than five. Widget nodes show their widget's icon and name, with the action they run
// underneath unless it is "start", and one input bar per action port (see widgetPorts), labelled when it has more
// than its main one.
import { Fragment, useEffect } from 'react'
import { Handle, useUpdateNodeInternals } from '@xyflow/react'
import { IconAlertTriangle, IconBolt, IconBox, IconPlugOff, createReactComponent } from '@tabler/icons-react'
import { deckIcons } from './Deck.jsx'

// A node or widget type with its icon as Icon: a Tabler component drawn from the SVG shapes the server sends (iconNode, for
// the icon its file names), turned iconRotate degrees (e.g. if/else branches left to right, like the graph).
export function withIcon(type) {
  if (!type.iconNode) return type
  const Svg = createReactComponent('outline', type.icon, type.icon, type.iconNode)
  const turn = type.iconRotate && `rotate(${type.iconRotate}deg)`
  return { ...type, Icon: turn ? ({ style, ...props }) => <Svg {...props} style={{ ...style, transform: turn }} /> : Svg }
}

// Category colors, from the editor theme (themes.js).
export const colors = {
  trigger: 'var(--ovrly-trigger)',
  logic: 'var(--ovrly-logic)',
  action: 'var(--ovrly-action)',
  widget: 'var(--ovrly-widget)',
}

// A node's outputs as [{ id, label }]: its type's fixed ones (if/else's true and false), after one per item of a list
// setting if it has one (a switch's cases: labelled by the case, id = position from 1, so links survive renaming; a
// Stream Deck's buttons: labelled by name, id = the button's, with its icon and color).
export function outputsOf(def, config) {
  const items = def?.outputsFrom ? config?.[def.outputsFrom] ?? def.config[def.outputsFrom] : []
  return [
    ...items.map((item, i) => (item?.id ? { id: item.id, label: item.name || item.id, icon: deckIcons[item.icon], color: item.color }
      : { id: String(i + 1), label: item || String(i + 1) })),
    ...(def?.outputs ?? []).map((id) => ({ id, label: id })),
  ]
}

// Places a widget node's ports (ids, null for the main one) like a node's inputs: each gets one slot per link into it
// (counts: port id, '' for the main one -> links; one slot at least), PORT apart, a port's first slot right after the
// previous port's last. Returns [{ id, first, slots }].
export function portSlots(ids, counts = {}) {
  let at = 0
  return ids.map((id) => {
    const slots = Math.max(1, counts[id ?? ''] ?? 0)
    at += slots
    return { id, first: at - slots, slots }
  })
}
// The slots placed ports take.
export const slotCount = (ports) => ports.at(-1).first + ports.at(-1).slots

// A widget node's input ports as [{ id, label, first, slots }] (see portSlots): its main one (id null: the action
// signals run, onSignal), then one per action exposed in its settings, in their order there (config.ports, id = the
// action; one its type no longer has is left out). type: the widget's type.
export function widgetPorts(type, config, counts) {
  const ids = (config?.ports ?? []).filter((a) => a !== type?.onSignal && type?.actions[a])
  return portSlots([null, ...ids], counts).map((p) => ({ ...p, label: p.id ?? type?.onSignal }))
}

// A node box is NODE square; its ports (inputs and outputs alike) are PORT apart around its middle. Heights are whole
// PORTs, so on a node snapped to the 10px grid (Workflow.jsx) every port is on a grid line: a link between two level
// ports is straight.
export const NODE = 80
export const PORT = 20
// Port i of n: its height from the node's middle.
export const portY = (i, n) => (i - (n - 1) / 2) * PORT

// A node's height: NODE, taller with more outputs or inputs, keeping a PORT between the end outputs and the corners,
// and about as much between the ends of the input bars (8px past their end handles) and the corners.
export function nodeHeight(def, config, inputs = 0) {
  return Math.max(NODE, (outputsOf(def, config).length + 1) * PORT, (inputs + 2) * PORT)
}

// Field types too long or too secret for the subtitle.
const unshown = ['json', 'code', 'secret']

// Subtitle like n8n's "mode: Rules": the node's first setting (not JSON, code or a secret). A widget node shows the
// action a signal runs unless it is its start action (TwitchPlays: "push").
// Also on the Basic view's cards (Basic.jsx). data: as FlowNode gets it.
export function subtitle({ type: nodeType, config, def, widgetType: type }) {
  const [key, value] = Object.entries({ ...def?.config, ...config })
    .find(([k]) => !def?.fields?.[k]?.hidden && !unshown.includes(def?.fields?.[k]?.type)) ?? []
  const shown = Array.isArray(value) ? value.map((v) => v?.name ?? v).join(', ')
    : def?.fields?.[key]?.type === 'tags' ? value.split('+').join(', ') : value
  return nodeType === 'widget' ? type?.onSignal !== type?.onStart && type?.onSignal
    : nodeType === 'merge' ? null // its only setting is the placement
    : key && shown !== '' && `${key}: ${shown}`
}

// The bolt of a trigger fired by hand: onFire() fires it (Workflow.jsx fireNode), the workflow running on from there.
export function Bolt({ onFire }) {
  return (
    <button className="bolt nodrag" title="Fire: runs the workflow from this trigger" aria-label="Fire this trigger"
      onKeyDown={(e) => e.stopPropagation()} onClick={(e) => {
        e.stopPropagation() // don't select the node (which opens its settings)
        onFire()
      }}>
      <IconBolt size={18} fill="currentColor" />
    </button>
  )
}

// The editor passes in data: def, its node type; widget, the instance a widget node points to (undefined for a deleted
// one); widgetType, that widget's type; missing,
// what it needs that isn't ready (requirement notes); fire(), fires the trigger by hand.
export default function FlowNode({ id, data, selected }) {
  const { def, widget, widgetType: type, missing = [] } = data
  const outputs = outputsOf(def, data.config)
  // Handles added or removed (a switch case) must be measured again, or links to them are misplaced.
  const updateNodeInternals = useUpdateNodeInternals()
  const isWidget = data.type === 'widget'
  // One input handle per incoming link, so their ends don't overlap; on a widget node, per link into each port.
  const ports = isWidget && widgetPorts(type, data.config, data.portLinks)
  const inputs = ports ? slotCount(ports) : Math.max(1, data.inputs ?? 0)
  const at = (slot) => `calc(50% + ${portY(slot, inputs)}px)`
  const handles = outputs.map((o) => o.id).join() + inputs + (ports ? ports.map((p) => `${p.id}:${p.slots}`).join() : '')
  useEffect(() => updateNodeInternals(id), [handles])
  const Icon = (isWidget ? type : def)?.Icon ?? IconBox
  const trigger = def?.category === 'trigger'
  const sub = subtitle(data)
  return (
    <div className={`flow-node${trigger ? ' trigger' : ''}${selected ? ' selected' : ''}`} style={{ height: nodeHeight(def, data.config, inputs) }}>
      {def?.manual && <Bolt onFire={data.fire} />}
      {!def || (widget && !type) ? <span className="needs unknown" title={`Unknown ${def ? 'widget' : 'node'} type "${def ? widget.type : data.type}"`}><IconAlertTriangle size={12} /></span>
        : missing.length > 0 && <span className="needs" title={missing.map((m) => `Needs ${m}.`).join(' ')}><IconPlugOff size={12} /></span>}
      {ports ? ports.map((p) => (
        <Fragment key={p.id ?? ''}>
          <div className="in-bar" style={{ top: at(p.first + (p.slots - 1) / 2), height: (p.slots - 1) * PORT + 16 }}>
            {ports.length > 1 && <span className="in-port">{p.label}</span>}
          </div>
          {Array.from({ length: p.slots }, (_, j) => (
            <Handle key={j} id={`${p.id ?? ''}#${j}`} type="target" position="left" className="in" style={{ top: at(p.first + j) }} />
          ))}
        </Fragment>
      )) : !trigger && (
        <>
          <div className="in-bar" style={{ height: (inputs - 1) * PORT + 16 }} />
          {Array.from({ length: inputs }, (_, i) => <Handle key={i} id={`in${i}`} type="target" position="left" className="in" style={{ top: at(i) }} />)}
        </>
      )}
      <Icon size={40} stroke={1.5} color={colors[def?.category]} />
      {outputs.length ? outputs.map((o, i) => (
        <Handle key={o.id} id={o.id} type="source" position="right" className="out" style={{ top: `calc(50% + ${portY(i, outputs.length)}px)` }}>
          <span className="port">{o.icon && <o.icon size={10} color={o.color} />}{o.label}</span>
        </Handle>
      )) : <Handle type="source" position="right" className="out" />}
      <div className="caption">
        <div className="label">{isWidget ? widget?.state.name ?? 'Missing widget' : def?.label ?? data.label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}
