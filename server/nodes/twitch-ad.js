// Action: starts an ad break, or snoozes the next scheduled one by 5 minutes. Adds { adLength } (the ad break's, in
// seconds) or { adSnoozes } (snoozes left).
import { helix, status } from '../integrations/twitch-auth.js'
import { needStreamer } from '../integrations/twitch.js'

export default {
  type: 'twitch-ad',
  label: 'Ad Break',
  icon: 'ad',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Starts an ad break (while live), or snoozes the next scheduled one by 5 minutes.',
  adds: {
    adLength: { info: 'Length of the ad break, in seconds', only: { action: 'run' } },
    adSnoozes: { info: 'Snoozes left', only: { action: 'snooze' } },
  },
  fields: {
    action: { options: [{ value: 'run', label: 'Start' }, { value: 'snooze', label: 'Snooze' }] },
    length: { unit: 's', presets: [30, 60, 90, 120, 180], only: { action: 'run' }, hint: 'Up to 180 s' },
  },
  config: { action: 'run', length: 60 },
  async run({ config, data }) {
    needStreamer('Ad breaks')
    if (config.action === 'snooze') {
      const [snooze] = await helix('POST', 'channels/ads/schedule/snooze', undefined, { broadcaster_id: status.userId })
      return { ...data, adSnoozes: snooze.snooze_count }
    }
    const [ad] = await helix('POST', 'channels/commercial', { length: config.length })
    return { ...data, adLength: ad.length }
  },
}
