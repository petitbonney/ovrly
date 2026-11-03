// Action: looks up a viewer or channel on Twitch. Adds { profileLogin, profileId, profileAvatar,
// profileAgeDays (the account's age), profileFollowDays (how long they have followed this channel; empty if they don't),
// profileTier (their sub tier; 0 if not subbed), profileGame (the last category they streamed) }, e.g. for an If/Else
// on {{profileFollowDays}}. Prefixed, so a chat trigger's login and userId stay those of who wrote.
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
  adds: { profileLogin: 'Their login (lowercase name)', profileId: 'Their Twitch user id', profileAvatar: 'Their profile picture URL',
    profileAgeDays: 'Days since the account was made', profileFollowDays: 'Days they have followed you (empty if not)',
    profileTier: 'Their sub tier here (0 if not subbed)', profileGame: 'The last category they streamed' },
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
    return { ...data, profileLogin: u.login, profileId: u.id, profileAvatar: u.profile_image_url, profileAgeDays: days(u.created_at),
      profileFollowDays: days(follow?.followed_at), profileTier: sub ? Number(sub.tier) / 1000 : 0, profileGame: ch?.game_name ?? '' }
  },
}
