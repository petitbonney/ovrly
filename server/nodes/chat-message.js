// Trigger: fires on every chat message. data = { user, message, channel, messageId } (for a reply or Delete Message).
export default {
  type: 'chat-message',
  label: 'Chat Message',
  category: 'trigger',
  group: 'Chat',
  description: 'Fires on every chat message.',
  adds: ['user', 'message', 'channel', 'messageId'],
  event: 'chat',
  config: {},
  run: ({ data }) => data,
}
