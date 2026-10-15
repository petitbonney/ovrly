// Trigger: fires on every chat message. data = { user, message, channel }.
export default {
  type: 'chat-message',
  label: 'Chat message',
  category: 'trigger',
  description: 'Fires on every chat message.',
  adds: ['user', 'message', 'channel'],
  event: 'chat',
  config: {},
  run: ({ data }) => data,
}
