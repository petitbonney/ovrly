// Trigger: fires when another channel raids this one. From EventSub in Streamer mode, from chat otherwise.
// data = { user (the raiding channel), viewers }.
export default {
  type: 'raid',
  label: 'Raid',
  icon: 'swords',
  category: 'trigger',
  needs: ['chat'],
  group: 'Twitch',
  description: 'Fires when another channel raids this one.',
  adds: ['user', 'viewers'],
  fields: { minViewers: { label: 'Minimum viewers', presets: [1, 3, 10, 25, 50] } },
  event: 'channel.raid',
  config: { minViewers: 1 },
  manual: {
    config: (config) => ({ viewers: Number(config.minViewers) || 1, user: '{{ $vars.channel }}' }),
    fields: { viewers: { presets: [1, 3, 10, 25, 50] } },
    event: ({ viewers, user }) => ({ data: { from_broadcaster_user_name: user, viewers: Number(viewers) } }),
  },
  run({ config, data }) {
    if (data.viewers < Number(config.minViewers)) return null
    return { user: data.from_broadcaster_user_name, viewers: data.viewers }
  },
}
