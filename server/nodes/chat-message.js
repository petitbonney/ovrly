// Trigger: fires on every chat message. data = { user, message, channel }.
export default {
  type: 'chat-message',
  label: 'Chat Message',
  category: 'trigger',
  group: 'Chat',
  description: 'Fires on every chat message.',
  adds: ['user', 'message', 'channel'],
  event: 'chat',
  config: {},
  run: ({ data }) => data,
}
