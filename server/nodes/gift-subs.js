// Trigger: fires once when someone gifts subs, once they're all in (5s at most; see twitch.js). From EventSub in
// Streamer mode, from chat otherwise. data = { user ("Anonymous" when hidden), tier (1-3), count, total (all their
// gifts here, when known), recipients: the names of those who received them }.
export default {
  type: 'gift-subs',
  label: 'Gift Subs',
  icon: 'gift',
  category: 'trigger',
  needs: ['chat'],
  group: 'Twitch',
  description: 'Fires once when someone gifts subs, with how many and to whom.',
  adds: ['user', 'tier', 'count', 'total', 'recipients'],
  fields: { minGifts: { label: 'Minimum gifts', presets: [1, 5, 10, 20, 50] } },
  event: 'twitch.gift',
  config: { minGifts: 1 },
  manual: {
    config: (config) => ({ count: Number(config.minGifts) || 1, user: '{{ $vars.channel }}' }),
    fields: { count: { presets: [1, 5, 10, 20, 50] } },
    event: ({ count, user }) => ({
      data: { user_name: user, tier: '1000', total: Number(count), recipients: Array.from({ length: Number(count) }, (_, i) => `TestViewer${i + 1}`) },
    }),
  },
  run({ config, data }) {
    if (data.total < Number(config.minGifts)) return null
    return { user: data.is_anonymous ? 'Anonymous' : data.user_name, tier: Number(data.tier) / 1000 || 1,
      count: data.total, total: data.cumulative_total ?? '', recipients: data.recipients }
  },
}
