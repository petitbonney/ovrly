// Trigger: fires when someone follows the channel (Twitch EventSub, Streamer mode). data = { user }.
export default {
  type: 'follow',
  label: 'Follow',
  icon: 'heart',
  category: 'trigger',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Fires when someone follows the channel.',
  adds: ['user'],
  event: 'channel.follow',
  config: {},
  manual: { config: { user: 'TestViewer' }, event: ({ user }) => ({ data: { user_name: user } }) },
  run: ({ data }) => ({ user: data.user_name }),
}
