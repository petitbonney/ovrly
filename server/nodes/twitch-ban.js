// Action: times out, bans or unbans a viewer in the streamer's chat.
import { helix, channel, user } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-ban',
  label: 'Ban / Timeout',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Times out, bans or unbans a viewer.',
  fields: {
    action: { options: ['timeout', 'ban', 'unban'] },
    user: { vars: true, hint: 'A login or display name, e.g. {{user}} from a chat trigger' },
    duration: { unit: 's', presets: [1, 60, 600, 3600, 86400], only: { action: 'timeout' }, hint: 'Up to 2 weeks; 1 s clears their messages' },
    reason: { vars: true, only: { action: ['timeout', 'ban'] }, hint: 'Shown to the viewer and the mods; optional' },
  },
  config: { action: 'timeout', user: '{{user}}', duration: 60, reason: '' },
  async run({ config, data }) {
    needStreamer('Bans and timeouts')
    const target = await user(fill(config.user, data))
    if (config.action === 'unban') {
      await helix('DELETE', 'moderation/bans', undefined, { ...channel(), user_id: target.id })
      return data
    }
    const reason = fill(config.reason, data).trim()
    await helix('POST', 'moderation/bans', { data: { user_id: target.id, ...(reason && { reason }),
      ...(config.action === 'timeout' && { duration: config.duration }) } }, channel())
    return data
  },
}
