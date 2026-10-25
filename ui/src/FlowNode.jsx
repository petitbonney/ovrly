// n8n-style graph node: icon box with the label underneath; triggers get a rounded left side. Triggers that can be
// tried from here (Manual Trigger, chat triggers) get a bolt that fires them. A node whose needs aren't met (an
// integration not ready) gets a warning badge. Nodes with several outputs (if/else, switch) get one labelled handle
// each, and grow taller with more than five. Widget nodes show their widget's icon and name, with the action they run
// underneath unless it is "start".
import { useEffect } from 'react'
import { Handle, useUpdateNodeInternals } from '@xyflow/react'
import { IconBolt, IconBox, IconPlugOff, createReactComponent } from '@tabler/icons-react'
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

// A node's height: 90px, taller with more than four outputs or inputs (18px apart, the same gap for both), keeping
// a gap of 18px between the end handles and the corners.
export function nodeHeight(def, config, inputs = 0) {
  return Math.max(90, (outputsOf(def, config).length + 1) * 18, (inputs + 1) * 18)
}

// Field types too long or too secret for the subtitle.
const unshown = ['json', 'code', 'secret']

// The editor passes in data: workflowId, the workflow the node is in; def, its node type; widget, the instance a widget or
// Widget Action node points to (undefined for a deleted one, or none linked); widgetType, that widget's type; missing,
// what it needs that isn't ready (requirement notes).
export default function FlowNode({ id, data, selected }) {
  const { workflowId, def, widget, widgetType: type, missing = [] } = data
  const outputs = outputsOf(def, data.config)
  // Handles added or removed (a switch case) must be measured again, or links to them are misplaced.
  const updateNodeInternals = useUpdateNodeInternals()
  const inputs = Math.max(1, data.inputs ?? 0) // one input handle per incoming link, so their ends don't overlap
  const handles = outputs.map((o) => o.id).join() + inputs
  useEffect(() => updateNodeInternals(id), [handles])
  const isWidget = data.type === 'widget'
  const Icon = (isWidget ? type : def)?.Icon ?? IconBox
  const trigger = def?.category === 'trigger'
  // The bolt runs a Manual Trigger, or sends a chat trigger a test message (server: /api/workflows/:id/run).
  const testable = data.type === 'manual' || [def?.event].flat().includes('chat')
  // Subtitle like n8n's "mode: Rules": the node's first setting (not JSON, code or a secret). A widget node shows the
  // action a signal runs unless it is its start action (TwitchPlays: "push"), a Widget Action node its widget and action.
  const [key, value] = Object.entries({ ...def?.config, ...data.config })
    .find(([k]) => !def?.fields?.[k]?.hidden && !unshown.includes(def?.fields?.[k]?.type)) ?? []
  const shown = Array.isArray(value) ? value.map((v) => v?.name ?? v).join(', ') : value
  const sub = isWidget ? type?.onSignal !== type?.onStart && type?.onSignal
    : data.type === 'merge' ? null // its only setting is the placement
    : data.type === 'widget-action' ? [widget?.state.name ?? 'no widget', widget && (data.config.action || type?.onStop)].filter(Boolean).join(': ')
    : key && shown !== '' && `${key}: ${shown}`
  return (
    <div className={`flow-node${trigger ? ' trigger' : ''}${selected ? ' selected' : ''}`} style={{ height: nodeHeight(def, data.config, inputs) }}>
      {testable && (
        <button className="bolt nodrag" title={data.type === 'manual' ? 'Run this trigger' : 'Test: send it a chat message from TestViewer'}
          aria-label={data.type === 'manual' ? 'Run this trigger' : 'Test this trigger'} onClick={(e) => {
            e.stopPropagation() // don't select the node (which opens its editor)
            fetch(`/api/workflows/${workflowId}/run?node=${id}`, { method: 'POST' })
          }}>
          <IconBolt size={18} fill="currentColor" />
        </button>
      )}
      {missing.length > 0 && <span className="needs" title={missing.map((m) => `Needs ${m}.`).join(' ')}><IconPlugOff size={12} /></span>}
      {!trigger && <div className="in-bar" style={{ height: (inputs - 1) * 18 + 22 }} />}
      {!trigger && Array.from({ length: inputs }, (_, i) => (
        <Handle key={i} id={`in${i}`} type="target" position="left" className="in" style={{ top: `calc(50% + ${(i - (inputs - 1) / 2) * 18}px)` }} />
      ))}
      <Icon size={40} stroke={1.5} color={colors[def?.category]} />
      {outputs.length ? outputs.map((o, i) => (
        <Handle key={o.id} id={o.id} type="source" position="right" className="out" style={{ top: `calc(50% + ${(i - (outputs.length - 1) / 2) * 18}px)` }}>
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
