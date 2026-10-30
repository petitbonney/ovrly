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
  manual: {
    config: (config) => ({ kind: config.kinds[0] ?? 'sub', user: 'TestViewer', tier: '1', months: 3, message: '' }),
    fields: {
      kind: { options: kinds },
      tier: { options: [{ value: '1', label: 'Tier 1' }, { value: '2', label: 'Tier 2' }, { value: '3', label: 'Tier 3' }] },
      months: { only: { kind: 'resub' } },
      message: { only: { kind: 'resub' } },
    },
    event: ({ kind, user, tier, months, message }) => (kind === 'resub'
      ? { event: 'channel.subscription.message', data: { user_name: user, tier: `${tier}000`, cumulative_months: Number(months), streak_months: Number(months), message: { text: message } } }
      : { event: 'channel.subscribe', data: { user_name: user, tier: `${tier}000`, is_gift: kind === 'gifted' } }),
  },
  run({ config, data, event }) {
    const kind = event === 'channel.subscription.message' ? 'resub' : data.is_gift ? 'gifted' : 'sub'
    if (!config.kinds.includes(kind)) return null
    return { kind, user: data.user_name, tier: Number(data.tier) / 1000 || 1, months: data.cumulative_months ?? '',
      streak: data.streak_months ?? '', message: data.message?.text ?? '' }
  },
}
