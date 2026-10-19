// Trigger: fires when someone follows the channel (Twitch EventSub, Streamer mode). data = { user }.
export default {
  type: 'follow',
  label: 'Follow',
  category: 'trigger',
  streamer: true,
  description: 'Fires when someone follows the channel.',
  adds: ['user'],
  event: 'channel.follow',
  config: {},
  run: ({ data }) => ({ user: data.user_name }),
}
