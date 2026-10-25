// Action: deletes a chat message, e.g. the one that fired a chat trigger ({{messageId}}).
import { helix, channel } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-delete-message',
  label: 'Delete Message',
  icon: 'trash',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Deletes a chat message, e.g. the one that fired the trigger.',
  fields: { messageId: { label: 'Message ID', vars: true, hint: 'e.g. {{messageId}} from a chat trigger' } },
  config: { messageId: '{{messageId}}' },
  async run({ config, data }) {
    needStreamer('Deleting messages')
    const id = fill(config.messageId, data).trim()
    // Without a message ID, Twitch would clear the whole chat.
    if (!id) throw new Error('Delete Message: no message ID')
    await helix('DELETE', 'moderation/chat', undefined, { ...channel(), message_id: id })
    return data
  },
}
