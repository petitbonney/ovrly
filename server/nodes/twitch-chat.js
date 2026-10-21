// Action: sends a chat message as the streamer, or a reply to one (e.g. to {{messageId}} from a chat trigger).
import { helix, status } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-chat',
  label: 'Send Chat Message',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Sends a chat message as the streamer, or a reply to one.',
  fields: {
    message: { vars: true, multiline: true, hint: 'Up to 500 characters' },
    replyTo: { label: 'Reply to', vars: true, hint: 'A message ID, e.g. {{messageId}} from a chat trigger; empty: not a reply' },
  },
  config: { message: 'Thanks {{user}}!', replyTo: '' },
  async run({ config, data }) {
    needStreamer('Chat messages')
    const replyTo = fill(config.replyTo, data).trim()
    const [sent] = await helix('POST', 'chat/messages', { sender_id: status.userId, message: fill(config.message, data),
      ...(replyTo && { reply_parent_message_id: replyTo }) })
    if (!sent.is_sent) throw new Error(`Twitch chat: message not sent (${sent.drop_reason?.message ?? 'dropped'})`)
    return data
  },
}
