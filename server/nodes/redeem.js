// Trigger: fires when a viewer redeems a channel points reward (Twitch EventSub, Streamer mode).
// data = { user, rewardTitle, rewardCost, rewardInput, redemptionId, rewardId } (the IDs for Channel Points Redemption).
export default {
  type: 'redeem',
  label: 'Channel Points',
  icon: 'sparkles',
  category: 'trigger',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Fires when a viewer redeems a channel points reward.',
  adds: { user: 'Who redeemed it', rewardTitle: 'The reward', rewardCost: 'Its cost in points', rewardInput: 'The text they typed, if it asks for one',
    redemptionId: 'This redemption, to fulfill or refund it', rewardId: 'The reward, for Channel Points Reward' },
  fields: { reward: { rewards: true, hint: 'Empty for any reward' } },
  event: 'channel.channel_points_custom_reward_redemption.add',
  config: { reward: '' },
  // Fired by hand: the reward set (no IDs: Channel Points Redemption can't fulfill it).
  manual: {
    config: { user: '{{ $vars.channel }}', input: '' },
    event: ({ user, input }, config) => ({
      data: { id: '', user_name: user, user_input: input, reward: { id: '', title: config.reward.trim() || 'Test reward', cost: 0 } },
    }),
  },
  run({ config, data }) {
    const reward = config.reward.trim().toLowerCase()
    if (reward && data.reward.title.toLowerCase() !== reward) return null
    return { user: data.user_name, rewardTitle: data.reward.title, rewardCost: data.reward.cost, rewardInput: data.user_input ?? '',
      redemptionId: data.id, rewardId: data.reward.id }
  },
}
