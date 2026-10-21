// Action: marks a channel points redemption as fulfilled, or refunds it (its points go back to the viewer). Twitch only
// lets an app change the redemptions of rewards it made: those of Channel Points Reward nodes.
import { helix, status } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-redemption',
  label: 'Complete Redemption',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Marks a channel points redemption as fulfilled, or refunds it. Only for rewards made by a Channel Points Reward node.',
  fields: {
    status: { label: 'Mark as', options: [{ value: 'FULFILLED', label: 'Fulfilled' }, { value: 'CANCELED', label: 'Refunded' }] },
    redemption: { label: 'Redemption ID', vars: true, hint: 'e.g. {{redemptionId}} from a Channel Points trigger' },
    reward: { label: 'Reward ID', vars: true, hint: 'e.g. {{rewardId}} from a Channel Points trigger' },
  },
  config: { status: 'FULFILLED', redemption: '{{redemptionId}}', reward: '{{rewardId}}' },
  async run({ config, data }) {
    needStreamer('Channel points redemptions')
    await helix('PATCH', 'channel_points/custom_rewards/redemptions', { status: config.status },
      { broadcaster_id: status.userId, reward_id: fill(config.reward, data).trim(), id: fill(config.redemption, data).trim() })
    return data
  },
}
