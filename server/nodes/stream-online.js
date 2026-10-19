// Trigger: fires when the stream goes live (Twitch EventSub, Streamer mode). data = { type: live, rerun, premiere… }.
export default {
  type: 'stream-online',
  label: 'Stream Online',
  category: 'trigger',
  streamer: true,
  description: 'Fires when the stream goes live.',
  adds: ['type'],
  event: 'stream.online',
  config: {},
  run: ({ data }) => ({ type: data.type }),
}
