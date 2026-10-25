// Trigger: fires when someone receives a sub, by kind: sub (new, bought), resub (shared in chat) or gifted (one per
// sub received from a gift; who gave it is the Gift Subs trigger). From EventSub in Streamer mode, from chat otherwise.
// Keys that don't apply to a kind are empty.
const kinds = [
  { value: 'sub', label: 'New sub' },
  { value: 'resub', label: 'Resub' },
  { value: 'gifted', label: 'Gifted sub' },
]

export default {
  type: 'subscription',
  label: 'Subscription',
  icon: 'star',
  category: 'trigger',
  needs: ['chat'],
  group: 'Twitch',
  description: 'Fires when someone receives a sub: new, resub or gifted; "kind" says which.',
  adds: ['kind', 'user', 'tier', 'months', 'streak', 'message'],
  fields: { kinds: { label: 'Fires on', options: kinds } },
  event: ['channel.subscribe', 'channel.subscription.message'],
  config: { kinds: ['sub', 'resub', 'gifted'] },
  run({ config, data, event }) {
    const kind = event === 'channel.subscription.message' ? 'resub' : data.is_gift ? 'gifted' : 'sub'
    if (!config.kinds.includes(kind)) return null
    return { kind, user: data.user_name, tier: Number(data.tier) / 1000 || 1, months: data.cumulative_months ?? '',
      streak: data.streak_months ?? '', message: data.message?.text ?? '' }
  },
}
