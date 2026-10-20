// Trigger: fires when a viewer redeems a channel points reward (Twitch EventSub, Streamer mode).
// data = { user, reward, cost, input }.
export default {
  type: 'redeem',
  label: 'Channel Points',
  category: 'trigger',
  group: 'Twitch',
  streamer: true,
  description: 'Fires when a viewer redeems a channel points reward.',
  adds: ['user', 'reward', 'cost', 'input'],
  fields: { reward: { hint: 'Reward title; empty for any reward' } },
  event: 'channel.channel_points_custom_reward_redemption.add',
  config: { reward: '' },
  run({ config, data }) {
    const reward = config.reward.trim().toLowerCase()
    if (reward && data.reward.title.toLowerCase() !== reward) return null
    return { user: data.user_name, reward: data.reward.title, cost: data.reward.cost, input: data.user_input ?? '' }
  },
}
