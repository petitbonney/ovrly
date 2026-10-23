// Trigger: fires on a chat message starting with a command (or one of its aliases), e.g. "!spin red", from viewers
// of at least the role set. Adds { command (as typed), args }.
import { sentBy } from '../sources/twitch.js'

// Each role includes those above it, as in chat bots: VIPs also lets mods and the streamer in.
const roles = ['everyone', 'sub', 'vip', 'mod', 'broadcaster']
export default {
  type: 'chat-command',
  label: 'Chat !command',
  category: 'trigger',
  needs: ['chat'],
  group: 'Chat',
  description: 'Fires when a chat message starts with a command, e.g. "!spin red".',
  adds: ['user', 'message', 'channel', 'messageId', 'login', 'userId', 'color', 'timestamp', 'broadcaster', 'mod', 'vip', 'sub', 'subMonths', 'firstMessage', 'returning', 'emotes', 'action', 'highlighted', 'rewardId', 'replyToId', 'replyToUser', 'replyToMessage', 'command', 'args'],
  fields: {
    command: { hint: 'Including the "!"' },
    aliases: { type: 'tags', hint: 'Other commands that do the same, e.g. !wheel' },
    from: {
      label: 'Who can use it',
      options: [{ value: 'everyone', label: 'Everyone' }, { value: 'sub', label: 'Subs' }, { value: 'vip', label: 'VIPs' }, { value: 'mod', label: 'Mods' }, { value: 'broadcaster', label: 'Streamer' }],
      slider: true,
      tips: { everyone: 'Any viewer', sub: 'Subs, VIPs, mods and the streamer', vip: 'VIPs, mods and the streamer', mod: 'Mods and the streamer', broadcaster: 'Only the streamer' },
      hint: 'This role and those to its right',
    },
  },
  event: 'chat',
  config: { command: '!spin', aliases: '', from: 'everyone' },
  run({ config, data, id }) {
    if (sentBy.get(data.messageId)?.includes(id)) return null // its own reply, back through chat
    const [first, ...args] = data.message.trim().split(/\s+/)
    const commands = [config.command, ...config.aliases.split('+')].map((c) => c.trim().toLowerCase())
    if (!commands.includes(first.toLowerCase())) return null
    const role = data.broadcaster ? 4 : data.mod ? 3 : data.vip ? 2 : data.sub ? 1 : 0
    if (role < roles.indexOf(config.from)) return null
    return { ...data, command: first, args }
  },
}
