// Trigger: fires when the stream ends (Twitch EventSub, Streamer mode). data = { channel }.
export default {
  type: 'stream-offline',
  label: 'Stream Offline',
  category: 'trigger',
  streamer: true,
  description: 'Fires when the stream ends.',
  adds: ['channel'],
  event: 'stream.offline',
  config: {},
  run: ({ data }) => ({ channel: data.broadcaster_user_name }),
}
