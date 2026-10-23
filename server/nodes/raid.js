// Trigger: fires when another channel raids this one. From EventSub in Streamer mode, from chat otherwise.
// data = { user (the raiding channel), viewers }.
export default {
  type: 'raid',
  label: 'Raid',
  category: 'trigger',
  needs: ['chat'],
  group: 'Twitch',
  description: 'Fires when another channel raids this one.',
  adds: ['user', 'viewers'],
  fields: { minViewers: { label: 'Minimum viewers' } },
  event: 'channel.raid',
  config: { minViewers: 1 },
  run({ config, data }) {
    if (data.viewers < Number(config.minViewers)) return null
    return { user: data.from_broadcaster_user_name, viewers: data.viewers }
  },
}
