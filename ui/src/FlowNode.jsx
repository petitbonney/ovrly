// n8n-style graph node: icon box with the label underneath; triggers get a rounded left side and a bolt.
import { Handle } from '@xyflow/react'
import {
  IconBolt, IconBox, IconEye, IconFilter, IconHourglass, IconKeyboard, IconLayoutDashboard,
  IconMessage, IconMessageCode, IconMovie, IconNotes, IconPlugConnected, IconWorld,
} from '@tabler/icons-react'

export const icons = {
  'chat-command': IconMessageCode,
  'chat-message': IconMessage,
  delay: IconHourglass,
  filter: IconFilter,
  'http-request': IconWorld,
  'key-press': IconKeyboard,
  log: IconNotes,
  'obs-scene': IconMovie,
  'obs-source': IconEye,
  'websocket-send': IconPlugConnected,
  'widget-update': IconLayoutDashboard,
}

export const colors = { trigger: 'var(--mantine-color-orange-5)', logic: 'var(--mantine-color-blue-4)', action: 'var(--mantine-color-grape-4)' }

export default function FlowNode({ data, selected, def }) {
  const Icon = icons[data.type] ?? IconBox
  const trigger = def?.category === 'trigger'
  // Subtitle like n8n's "mode: Rules": the node's first setting.
  const [key, value] = Object.entries({ ...def?.config, ...data.config })[0] ?? []
  return (
    <div className={`flow-node${trigger ? ' trigger' : ''}${selected ? ' selected' : ''}`}>
      {trigger && <IconBolt className="bolt" size={18} fill="currentColor" />}
      {!trigger && <Handle type="target" position="left" className="in" />}
      <Icon size={40} stroke={1.5} color={colors[def?.category]} />
      <Handle type="source" position="right" className="out" />
      <div className="caption">
        <div className="label">{data.label}</div>
        {key && value !== '' && <div className="sub">{key}: {String(value)}</div>}
      </div>
    </div>
  )
}
