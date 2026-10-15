// n8n-style graph node: icon box with the label underneath; triggers get a rounded left side and a bolt.
// Nodes with several outputs (if/else, switch) get one labelled handle each. Widget nodes show their widget.
import { Handle } from '@xyflow/react'
import {
  IconArrowsJoin2, IconArrowsSplit, IconBell, IconBolt, IconBox, IconChartBar, IconCoin, IconDeviceGamepad2,
  IconEye, IconFilter, IconGitBranch, IconHandClick, IconHourglass, IconKeyboard, IconLayoutDashboard, IconMessage,
  IconMessageCode, IconMovie, IconNotes, IconPlugConnected, IconWebhook, IconWheel, IconWorld,
} from '@tabler/icons-react'

export const icons = {
  'chat-command': IconMessageCode,
  'chat-message': IconMessage,
  webhook: IconWebhook,
  manual: IconHandClick,
  delay: IconHourglass,
  filter: IconFilter,
  'if-else': IconGitBranch,
  switch: IconArrowsSplit,
  'wait-all': IconArrowsJoin2,
  'http-request': IconWorld,
  'key-press': IconKeyboard,
  log: IconNotes,
  'obs-scene': IconMovie,
  'obs-source': IconEye,
  'websocket-send': IconPlugConnected,
  'widget-update': IconLayoutDashboard,
}

export const widgetIcons = {
  alerts: IconBell,
  poll: IconChartBar,
  bets: IconCoin,
  wheel: IconWheel,
  'twitch-plays': IconDeviceGamepad2,
}

export const colors = {
  trigger: 'var(--mantine-color-orange-5)',
  logic: 'var(--mantine-color-blue-4)',
  action: 'var(--mantine-color-grape-4)',
  widget: 'var(--mantine-color-teal-4)',
}

// widget: the widget a widget node points to (undefined if it was deleted).
export default function FlowNode({ data, selected, def, widget }) {
  const isWidget = data.type === 'widget-update'
  const Icon = (isWidget ? widgetIcons[widget?.type] : icons[data.type]) ?? IconBox
  const trigger = def?.category === 'trigger'
  // Subtitle like n8n's "mode: Rules": the node's first setting.
  const [key, value] = Object.entries({ ...def?.config, ...data.config })[0] ?? []
  const outputs = def?.outputs ?? []
  return (
    <div className={`flow-node${trigger ? ' trigger' : ''}${selected ? ' selected' : ''}`} style={{ height: Math.max(90, outputs.length * 24) }}>
      {trigger && <IconBolt className="bolt" size={18} fill="currentColor" />}
      {!trigger && <Handle type="target" position="left" className="in" />}
      <Icon size={40} stroke={1.5} color={colors[def?.category]} />
      {outputs.length ? outputs.map((o, i) => (
        <Handle key={o} id={o} type="source" position="right" className="out" style={{ top: `${((i + 1) * 100) / (outputs.length + 1)}%` }}>
          <span className="port">{o}</span>
        </Handle>
      )) : <Handle type="source" position="right" className="out" />}
      <div className="caption">
        <div className="label">{isWidget ? widget?.name ?? 'Missing widget' : data.label}</div>
        {isWidget ? <div className="sub">{data.config.action}</div> : key && value !== '' && <div className="sub">{key}: {String(value)}</div>}
      </div>
    </div>
  )
}
