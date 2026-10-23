// Trigger: fires when a viewer redeems a channel points reward (Twitch EventSub, Streamer mode).
// data = { user, reward, cost, input, redemptionId, rewardId } (the IDs for Channel Points Redemption).
export default {
  type: 'redeem',
  label: 'Channel Points',
  category: 'trigger',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Fires when a viewer redeems a channel points reward.',
  adds: ['user', 'reward', 'cost', 'input', 'redemptionId', 'rewardId'],
  fields: { reward: { rewards: true, hint: 'Empty for any reward' } },
  event: 'channel.channel_points_custom_reward_redemption.add',
  config: { reward: '' },
  run({ config, data }) {
    const reward = config.reward.trim().toLowerCase()
    if (reward && data.reward.title.toLowerCase() !== reward) return null
    return { user: data.user_name, reward: data.reward.title, cost: data.reward.cost, input: data.user_input ?? '',
      redemptionId: data.id, rewardId: data.reward.id }
  },
}
