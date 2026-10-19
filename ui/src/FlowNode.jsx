// n8n-style graph node: icon box with the label underneath; triggers get a rounded left side and a bolt.
// Nodes with several outputs (if/else, switch) get one labelled handle each, and grow taller with more than three. Widget nodes show their
// widget's icon and name, with the main action they run underneath.
import { useEffect } from 'react'
import { Handle, useUpdateNodeInternals } from '@xyflow/react'
import {
  IconAccessPoint, IconAccessPointOff, IconDiamond, IconFlame, IconGift, IconHeart, IconSparkles, IconStar, IconSwords,
  IconAlertTriangle, IconArrowBarToRight, IconArrowsJoin2, IconArrowsSplit, IconBell, IconBolt, IconBox, IconBroadcast, IconGif, IconSpeakerphone, IconChartBar, IconClock, IconClockPause, IconCode, IconClover, IconCoin, IconDeviceGamepad2, IconEdit,
  IconEye, IconFilter, IconGitBranch, IconHandClick, IconHourglass, IconKeyboard, IconLayoutDashboard, IconListNumbers, IconMessage,
  IconMessageCode, IconMovie, IconNotes, IconPhoto, IconPlugConnected, IconSubtask, IconVolume, IconVariable, IconWebhook, IconWindmill, IconWorld,
} from '@tabler/icons-react'

// If/else branches left to right, like the graph.
const IconIfElse = ({ style, ...props }) => <IconGitBranch {...props} style={{ ...style, transform: 'rotate(90deg)' }} />

export const icons = {
  'chat-command': IconMessageCode,
  'chat-message': IconMessage,
  follow: IconHeart,
  subscription: IconStar,
  'gift-subs': IconGift,
  cheer: IconDiamond,
  redeem: IconSparkles,
  raid: IconSwords,
  'stream-online': IconAccessPoint,
  'stream-offline': IconAccessPointOff,
  'hype-train': IconFlame,
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
  'fan-out': IconWindmill,
  'wait-all': IconArrowsJoin2,
  cooldown: IconClockPause,
  queue: IconListNumbers,
  'http-request': IconWorld,
  giphy: IconGif,
  myinstants: IconSpeakerphone,
  'key-press': IconKeyboard,
  log: IconNotes,
  'obs-scene': IconMovie,
  'obs-source': IconEye,
  'websocket-send': IconPlugConnected,
  'widget-callback': IconBroadcast,
  widget: IconLayoutDashboard,
}

export const widgetIcons = {
  alerts: IconBell,
  poll: IconChartBar,
  bets: IconCoin,
  lottery: IconClover,
  image: IconPhoto,
  sound: IconVolume,
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

// A node's height: 90px, taller with more than three outputs (24px each).
export function nodeHeight(def, config) {
  return Math.max(90, outputsOf(def, config).length * 24)
}

// workflowId: the workflow the node is in. widget: the instance a widget or Widget Callback node points to (undefined for a deleted one), type: its widget type.
export default function FlowNode({ id, workflowId, data, selected, def, widget, type }) {
  const outputs = outputsOf(def, data.config)
  // Handles added or removed (a switch case) must be measured again, or links to them are misplaced.
  const updateNodeInternals = useUpdateNodeInternals()
  const handles = outputs.map((o) => o.id).join()
  useEffect(() => updateNodeInternals(id), [handles])
  const isWidget = data.type === 'widget'
  const Icon = (isWidget ? widgetIcons[widget?.type] : icons[data.type]) ?? IconBox
  const trigger = def?.category === 'trigger'
  // Subtitle like n8n's "mode: Rules": the node's first setting. A widget node shows its main action, a Widget Callback
  // node its widget and action.
  const [key, value] = Object.entries({ ...def?.config, ...data.config })[0] ?? []
  const shown = Array.isArray(value) ? value.map((v) => v?.name ?? v).join(', ') : value
  const sub = isWidget ? type?.main
    : data.type === 'widget-callback' ? [widget?.name ?? 'no widget', widget && (data.config.action || type?.main)].filter(Boolean).join(': ')
    : key && shown !== '' && `${key}: ${shown}`
  return (
    <div className={`flow-node${trigger ? ' trigger' : ''}${selected ? ' selected' : ''}`} style={{ height: nodeHeight(def, data.config) }}>
      {data.type === 'manual' ? (
        <button className="bolt nodrag" title="Run this trigger" onClick={(e) => {
          e.stopPropagation() // don't select the node (which opens its editor)
          fetch(`/api/workflows/${workflowId}/run?node=${id}`, { method: 'POST' })
        }}>
          <IconBolt size={18} fill="currentColor" />
        </button>
      ) : trigger && <IconBolt className="bolt nodrag" size={18} fill="currentColor" onClick={(e) => e.stopPropagation()} />}
      {!trigger && <Handle type="target" position="left" className="in" />}
      <Icon size={40} stroke={1.5} color={colors[def?.category]} />
      {outputs.length ? outputs.map((o, i) => (
        <Handle key={o.id} id={o.id} type="source" position="right" className="out" style={{ top: `${((i + 1) * 100) / (outputs.length + 1)}%` }}>
          <span className="port">{o.label}</span>
        </Handle>
      )) : <Handle type="source" position="right" className="out" />}
      <div className="caption">
        <div className="label">{isWidget ? widget?.name ?? 'Missing widget' : def?.label ?? data.label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}
