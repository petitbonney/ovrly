// Trigger: fires when the stream goes live or ends (Twitch EventSub, Streamer mode). "streamStatus" says which;
// "streamType" (live, rerun, premiere…) is empty when it ends.
import { status as twitch } from '../integrations/twitch.js'

const statuses = [
  { value: 'online', label: 'Goes live' },
  { value: 'offline', label: 'Ends' },
]

export default {
  type: 'stream-status',
  label: 'Stream On/Off',
  icon: 'access-point',
  category: 'trigger',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Fires when the stream goes live or ends; "status" says which.',
  adds: { streamStatus: 'online or offline', streamType: 'live, rerun or premiere (empty when it ends)', channel: 'The channel' },
  fields: { statuses: { label: 'Fires on', options: statuses } },
  event: ['stream.online', 'stream.offline'],
  config: { statuses: ['online', 'offline'] },
  manual: {
    config: (config) => ({ status: config.statuses[0] ?? 'online' }),
    fields: { status: { options: statuses } },
    event: ({ status }) => ({ event: `stream.${status}`, data: { type: status === 'online' ? 'live' : undefined, broadcaster_user_name: twitch.channel } }),
  },
  run({ config, data, event }) {
    const status = event === 'stream.online' ? 'online' : 'offline'
    if (!config.statuses.includes(status)) return null
    return { streamStatus: status, streamType: data.type ?? '', channel: data.broadcaster_user_name }
  },
}
