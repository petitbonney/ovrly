// Trigger: fires once when someone gifts subs, once they're all in (5s at most; see twitch.js). From EventSub in
// Streamer mode, from chat otherwise. data = { user ("Anonymous" when hidden), tier (1-3), count, total (all their
// gifts here, when known), recipients: the names of those who received them }.
export default {
  type: 'gift-subs',
  label: 'Gift Subs',
  category: 'trigger',
  description: 'Fires once when someone gifts subs, with how many and to whom.',
  adds: ['user', 'tier', 'count', 'total', 'recipients'],
  event: 'twitch.gift',
  config: {},
  run: ({ data }) => ({ user: data.is_anonymous ? 'Anonymous' : data.user_name, tier: Number(data.tier) / 1000 || 1,
    count: data.total, total: data.cumulative_total ?? '', recipients: data.recipients }),
}
