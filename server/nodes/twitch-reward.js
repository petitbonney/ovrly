// Action: enables, disables, pauses or resumes a channel points reward, and can set its cost. Twitch only lets an app
// change rewards it made, so a reward is made here the first time (it can't be one made on the Twitch dashboard).
// Adds { rewardId }.
import { helix, status } from '../integrations/twitch-auth.js'
import { needStreamer } from '../integrations/twitch.js'
import { fill } from '../template.js'

const changes = { enable: { is_enabled: true }, disable: { is_enabled: false }, pause: { is_paused: true }, resume: { is_paused: false } }

export default {
  type: 'twitch-reward',
  label: 'Channel Points Reward',
  icon: 'ticket',
  category: 'action',
  group: 'Twitch',
  play: true,
  needs: ['twitch'],
  description: 'Enables, disables, pauses or resumes a channel points reward made by Ovrly (made here the first time).',
  adds: ['rewardId'],
  fields: {
    action: { options: Object.keys(changes), info: 'Disabled: hidden from viewers. Paused: shown, but can\'t be redeemed.' },
    reward: { vars: true, hint: 'Its title', info: 'A reward of that title made on the Twitch dashboard can\'t be changed here: Twitch only lets Ovrly change rewards it made.' },
    cost: { presets: [0, 100, 500, 1000, 5000], off: 'unchanged', hint: '100 for a new reward' },
  },
  config: { action: 'enable', reward: '', cost: 0 },
  async run({ config, data }) {
    needStreamer('Channel points rewards')
    const title = fill(config.reward, data).trim()
    if (!title) throw new Error('Channel Points Reward: no reward title')
    const query = { broadcaster_id: status.userId }
    const mine = await helix('GET', 'channel_points/custom_rewards', undefined, { ...query, only_manageable_rewards: true })
    const found = mine.find((r) => r.title.toLowerCase() === title.toLowerCase())
      ?? (await helix('POST', 'channel_points/custom_rewards', { title, cost: config.cost || 100 }, query))[0]
    await helix('PATCH', 'channel_points/custom_rewards', { ...changes[config.action], ...(config.cost > 0 && { cost: config.cost }) },
      { ...query, id: found.id })
    return { ...data, rewardId: found.id }
  },
}
