// Trigger: fires on every chat message. data = { user, message, channel, messageId, … } (messageId is for a reply or Delete Message).
export default {
  type: 'chat-message',
  label: 'Chat Message',
  category: 'trigger',
  group: 'Chat',
  description: 'Fires on every chat message.',
  adds: ['user', 'message', 'channel', 'messageId', 'login', 'userId', 'color', 'timestamp', 'broadcaster', 'mod', 'vip', 'sub', 'subMonths', 'firstMessage', 'returning', 'emotes', 'action', 'highlighted', 'rewardId', 'replyToId', 'replyToUser', 'replyToMessage'],
  event: 'chat',
  config: {},
  run: ({ data }) => data,
}
