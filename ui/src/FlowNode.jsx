// n8n-style graph node: icon box with the label underneath; triggers get a rounded left side and a bolt.
// Nodes with several outputs (if/else, switch) get one labelled handle each, and grow taller with more than three. Widget nodes are circles with a diamond
// connector on top, linked to the diamond input under Fire Widget nodes (diamonds only connect to diamonds).
import { useEffect } from 'react'
import { Handle, useUpdateNodeInternals } from '@xyflow/react'
import {
  IconAlertTriangle, IconArrowBarToRight, IconArrowsJoin2, IconArrowsSplit, IconBell, IconBolt, IconBox, IconBroadcast, IconChartBar, IconClock, IconClockPause, IconCode, IconCoin, IconDeviceGamepad2, IconDice5, IconEdit,
  IconEye, IconFilter, IconGitBranch, IconHandClick, IconHourglass, IconKeyboard, IconLayoutDashboard, IconListNumbers, IconMessage,
  IconMessageCode, IconMovie, IconNotes, IconPlugConnected, IconSubtask, IconVariable, IconWebhook, IconWorld,
} from '@tabler/icons-react'

// If/else branches left to right, like the graph.
const IconIfElse = ({ style, ...props }) => <IconGitBranch {...props} style={{ ...style, transform: 'rotate(90deg)' }} />

export const icons = {
  'chat-command': IconMessageCode,
  'chat-message': IconMessage,
  webhook: IconWebhook,
  schedule: IconClock,
  'error-trigger': IconAlertTriangle,
  'workflow-call': IconArrowBarToRight,
  'edit-data': IconEdit,
  code: IconCode,
  'edit-variable': IconVariable,
  'execute-workflow': IconSubtask,
  manual: IconHandClick,
  delay: IconHourglass,
  filter: IconFilter,
  'if-else': IconIfElse,
  switch: IconArrowsSplit,
  'wait-all': IconArrowsJoin2,
  cooldown: IconClockPause,
  queue: IconListNumbers,
  'http-request': IconWorld,
  'key-press': IconKeyboard,
  log: IconNotes,
  'obs-scene': IconMovie,
  'obs-source': IconEye,
  'websocket-send': IconPlugConnected,
  'fire-widget': IconBroadcast,
  widget: IconLayoutDashboard,
}

export const widgetIcons = {
  alerts: IconBell,
  poll: IconChartBar,
  bets: IconCoin,
  lottery: IconDice5,
  'twitch-plays': IconDeviceGamepad2,
}

export const colors = {
  trigger: 'var(--mantine-color-orange-5)',
  logic: 'var(--mantine-color-blue-4)',
  action: 'var(--mantine-color-grape-4)',
  widget: 'var(--mantine-color-teal-4)',
}

// A node's outputs as [{ id, label }]: its type's fixed ones (if/else's true and false), after one per item of a list
// setting if it has one (a switch's cases: labelled by the case, id = position from 1, so links survive renaming).
export function outputsOf(def, config) {
  const items = def?.outputsFrom ? config?.[def.outputsFrom] ?? def.config[def.outputsFrom] : []
  return [...items.map((item, i) => ({ id: String(i + 1), label: item || String(i + 1) })), ...(def?.outputs ?? []).map((id) => ({ id, label: id }))]
}

// A node's height: 90px, taller with more than three outputs (24px each). Widget nodes are 90px circles.
export function nodeHeight(def, config) {
  return def?.type === 'widget' ? 90 : Math.max(90, outputsOf(def, config).length * 24)
}

// widget: a widget node's instance, or the one linked to a Fire Widget node (undefined if none, or deleted).
export default function FlowNode({ id, data, selected, def, widget }) {
  const outputs = outputsOf(def, data.config)
  // Handles added or removed (a switch case) must be measured again, or links to them are misplaced.
  const updateNodeInternals = useUpdateNodeInternals()
  const handles = outputs.map((o) => o.id).join()
  useEffect(() => updateNodeInternals(id), [handles])
  if (data.type === 'widget') {
    const Icon = widgetIcons[widget?.type] ?? IconBox
    return (
      <div className={`flow-node widget${selected ? ' selected' : ''}`}>
        <Handle id="widget" type="source" position="top" className="diamond" />
        <Icon size={40} stroke={1.5} color={colors.widget} />
        <div className="caption"><div className="label">{widget?.name ?? 'Missing widget'}</div></div>
      </div>
    )
  }
  const Icon = icons[data.type] ?? IconBox
  const trigger = def?.category === 'trigger'
  // Subtitle like n8n's "mode: Rules": the node's first setting. A Fire Widget node shows its widget and action.
  const [key, value] = Object.entries({ ...def?.config, ...data.config })[0] ?? []
  const shown = Array.isArray(value) ? value.map((v) => v?.name ?? v).join(', ') : value
  const sub = def?.widgetInput ? [widget?.name ?? 'no widget', data.config.action].filter(Boolean).join(': ')
    : key && shown !== '' && `${key}: ${shown}`
  return (
    <div className={`flow-node${trigger ? ' trigger' : ''}${def?.widgetInput ? ' fires' : ''}${selected ? ' selected' : ''}`} style={{ height: nodeHeight(def, data.config) }}>
      {trigger && <IconBolt className="bolt" size={18} fill="currentColor" />}
      {!trigger && <Handle type="target" position="left" className="in" />}
      <Icon size={40} stroke={1.5} color={colors[def?.category]} />
      {outputs.length ? outputs.map((o, i) => (
        <Handle key={o.id} id={o.id} type="source" position="right" className="out" style={{ top: `${((i + 1) * 100) / (outputs.length + 1)}%` }}>
          <span className="port">{o.label}</span>
        </Handle>
      )) : <Handle type="source" position="right" className="out" />}
      {def?.widgetInput && <Handle id="widget" type="target" position="bottom" className="diamond" />}
      <div className="caption">
        <div className="label">{def?.label ?? data.label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}
