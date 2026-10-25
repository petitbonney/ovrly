// Action: gives another channel a Twitch shoutout, e.g. after a Raid trigger. Twitch only allows it while live, one
// every 2 minutes and one per channel per hour.
import { helix, status, user } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-shoutout',
  label: 'Shoutout',
  icon: 'heart-handshake',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Gives another channel a Twitch shoutout (while live; one every 2 minutes).',
  fields: { channel: { vars: true, hint: 'A login or display name, e.g. {{user}} from a Raid trigger' } },
  config: { channel: '{{user}}' },
  async run({ config, data }) {
    needStreamer('Shoutouts')
    const to = await user(fill(config.channel, data))
    await helix('POST', 'chat/shoutouts', undefined, { from_broadcaster_id: status.userId, to_broadcaster_id: to.id, moderator_id: status.userId })
    return data
  },
}
