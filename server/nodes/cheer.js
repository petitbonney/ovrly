// Trigger: fires when someone cheers bits. From EventSub in Streamer mode, from chat otherwise.
// data = { user ("Anonymous" when hidden), bits, message }.
export default {
  type: 'cheer',
  label: 'Cheer',
  icon: 'diamond',
  category: 'trigger',
  needs: ['chat'],
  group: 'Twitch',
  description: 'Fires when someone cheers bits.',
  adds: ['user', 'bits', 'message'],
  fields: { minBits: { label: 'Minimum bits', presets: [1, 100, 500, 1000, 5000] } },
  event: 'channel.cheer',
  config: { minBits: 1 },
  manual: {
    config: (config) => ({ bits: Number(config.minBits) || 1, user: '{{ $vars.channel }}', message: '' }),
    fields: { bits: { presets: [1, 100, 500, 1000, 5000] } },
    event: ({ bits, user, message }) => ({ data: { user_name: user, bits: Number(bits), message } }),
  },
  run({ config, data }) {
    if (data.bits < Number(config.minBits)) return null
    return { user: data.is_anonymous ? 'Anonymous' : data.user_name, bits: data.bits, message: data.message ?? '' }
  },
}
