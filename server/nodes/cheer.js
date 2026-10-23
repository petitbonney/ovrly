// Trigger: fires when someone cheers bits. From EventSub in Streamer mode, from chat otherwise.
// data = { user ("Anonymous" when hidden), bits, message }.
export default {
  type: 'cheer',
  label: 'Cheer',
  category: 'trigger',
  needs: ['chat'],
  group: 'Twitch',
  description: 'Fires when someone cheers bits.',
  adds: ['user', 'bits', 'message'],
  fields: { minBits: { label: 'Minimum bits' } },
  event: 'channel.cheer',
  config: { minBits: 1 },
  run({ config, data }) {
    if (data.bits < Number(config.minBits)) return null
    return { user: data.is_anonymous ? 'Anonymous' : data.user_name, bits: data.bits, message: data.message ?? '' }
  },
}
