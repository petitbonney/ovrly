// Trigger: fires on every chat message. data = { user, message, channel }.
export default {
  type: 'chat-message',
  label: 'Chat message',
  category: 'trigger',
  event: 'chat',
  config: {},
  run: ({ data }) => data,
}
