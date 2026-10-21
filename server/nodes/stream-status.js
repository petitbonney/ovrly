// Trigger: fires when the stream goes live or ends (Twitch EventSub, Streamer mode). "status" says which;
// "type" (live, rerun, premiere…) is empty when it ends.
const statuses = [
  { value: 'online', label: 'Goes live' },
  { value: 'offline', label: 'Ends' },
]

export default {
  type: 'stream-status',
  label: 'Stream On/Off',
  category: 'trigger',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Fires when the stream goes live or ends; "status" says which.',
  adds: ['status', 'type', 'channel'],
  fields: { statuses: { label: 'Fires on', options: statuses } },
  event: ['stream.online', 'stream.offline'],
  config: { statuses: ['online', 'offline'] },
  run({ config, data, event }) {
    const status = event === 'stream.online' ? 'online' : 'offline'
    if (!config.statuses.includes(status)) return null
    return { status, type: data.type ?? '', channel: data.broadcaster_user_name }
  },
}
