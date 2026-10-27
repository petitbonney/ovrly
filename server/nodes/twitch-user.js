// Action: looks up a viewer or channel on Twitch. Adds { login, userId, avatar, accountDays (the account's age),
// followDays (how long they have followed this channel; empty if they don't), tier (their sub tier; 0 if not subbed),
// game (the last category they streamed) }, e.g. for an If/Else on {{followDays}}.
import { helix, status, user } from '../integrations/twitch-auth.js'
import { needStreamer } from '../integrations/twitch.js'
import { fill } from '../template.js'

const days = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : '')

export default {
  type: 'twitch-user',
  label: 'User Info',
  icon: 'user-search',
  category: 'action',
  group: 'Twitch',
  play: true,
  needs: ['twitch'],
  description: 'Looks up a viewer or channel: avatar, account age, follow age, sub tier and last category.',
  adds: ['login', 'userId', 'avatar', 'accountDays', 'followDays', 'tier', 'game'],
  fields: { user: { vars: true, hint: 'A login or display name, e.g. {{user}}' } },
  config: { user: '{{user}}' },
  async run({ config, data }) {
    needStreamer('User info')
    const u = await user(fill(config.user, data))
    const query = { broadcaster_id: status.userId, user_id: u.id }
    const [[follow], [sub], [ch]] = await Promise.all([
      helix('GET', 'channels/followers', undefined, query),
      helix('GET', 'subscriptions', undefined, query),
      helix('GET', 'channels', undefined, { broadcaster_id: u.id }),
    ])
    return { ...data, login: u.login, userId: u.id, avatar: u.profile_image_url, accountDays: days(u.created_at),
      followDays: days(follow?.followed_at), tier: sub ? Number(sub.tier) / 1000 : 0, game: ch?.game_name ?? '' }
  },
}
