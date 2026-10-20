// Trigger: fires on a chat message starting with a command, e.g. "!spin red". Adds { command, args }.
export default {
  type: 'chat-command',
  label: 'Chat !command',
  category: 'trigger',
  group: 'Chat',
  description: 'Fires when a chat message starts with a command, e.g. "!spin red".',
  adds: ['user', 'message', 'channel', 'messageId', 'command', 'args'],
  fields: { command: { hint: 'Including the "!"' } },
  event: 'chat',
  config: { command: '!spin' },
  run({ config, data }) {
    const [first, ...args] = data.message.trim().split(/\s+/)
    if (first.toLowerCase() !== config.command.toLowerCase()) return null
    return { ...data, command: first, args }
  },
}
