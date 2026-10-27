// Trigger: fires on every chat message, from viewers of at least the role set, except those of the users ignored (chat
// bots by default). data = { user, message, channel, messageId, … } (messageId is for a reply or Delete Message).
import { sentBy } from '../integrations/twitch.js'

// Each role includes those above it, as in chat bots: VIPs also lets mods and the streamer in.
const roles = ['everyone', 'sub', 'vip', 'mod', 'broadcaster']

export default {
  type: 'chat-message',
  label: 'Chat Message',
  icon: 'message',
  category: 'trigger',
  needs: ['chat'],
  group: 'Chat',
  description: 'Fires on every chat message.',
  adds: ['user', 'message', 'channel', 'messageId', 'login', 'userId', 'color', 'timestamp', 'broadcaster', 'mod', 'vip', 'sub', 'subMonths', 'firstMessage', 'returning', 'emotes', 'action', 'highlighted', 'rewardId', 'replyToId', 'replyToUser', 'replyToMessage'],
  fields: {
    from: {
      options: [{ value: 'everyone', label: 'Everyone' }, { value: 'sub', label: 'Subs' }, { value: 'vip', label: 'VIPs' }, { value: 'mod', label: 'Mods' }, { value: 'broadcaster', label: 'Streamer' }],
      slider: true,
      tips: { everyone: 'Any viewer', sub: 'Subs, VIPs, mods and the streamer', vip: 'VIPs, mods and the streamer', mod: 'Mods and the streamer', broadcaster: 'Only the streamer' },
      hint: 'This role and those to its right',
    },
    firstOnly: { label: 'First message only', hint: "A viewer's first message ever in this chat" },
    ignore: { type: 'tags', hint: 'Users never fired on, e.g. chat bots' },
  },
  event: 'chat',
  config: { from: 'everyone', firstOnly: false, ignore: 'Nightbot+StreamElements+Streamlabs+Moobot+Fossabot' },
  run({ config, data, id }) {
    if (sentBy.get(data.messageId)?.includes(id)) return null // its own message, back through chat
    const role = data.broadcaster ? 4 : data.mod ? 3 : data.vip ? 2 : data.sub ? 1 : 0
    if (role < roles.indexOf(config.from) || (config.firstOnly && !data.firstMessage)) return null
    const ignored = config.ignore.split('+').map((u) => u.trim().toLowerCase())
    if (ignored.includes(data.login?.toLowerCase()) || ignored.includes(data.user?.toLowerCase())) return null
    return data
  },
}
