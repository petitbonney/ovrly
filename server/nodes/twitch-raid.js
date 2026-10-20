// Action: raids another channel and waits until the raid goes out (after Twitch's countdown, or Raid Now on Twitch),
// adding { viewers }; cancelling the workflow meanwhile cancels the raid. Or cancels the pending raid.
import bus from '../bus.js'
import { helix, status, user } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

const cancel = () => helix('DELETE', 'raids', undefined, { broadcaster_id: status.userId })

export default {
  type: 'twitch-raid',
  label: 'Raid',
  category: 'action',
  group: 'Twitch',
  streamer: true,
  description: 'Raids another channel and waits until the raid goes out (cancelling the workflow cancels it), or cancels the pending raid.',
  adds: ['viewers'],
  fields: {
    action: { options: [{ value: 'raid', label: 'Raid' }, { value: 'cancel', label: 'Cancel' }] },
    channel: { vars: true, only: { action: 'raid' }, hint: 'A login or display name' },
  },
  config: { action: 'raid', channel: '' },
  async run({ config, data, signal }) {
    needStreamer('Raids')
    if (config.action === 'cancel') {
      await cancel()
      return data
    }
    const to = await user(fill(config.channel, data))
    await helix('POST', 'raids', undefined, { from_broadcaster_id: status.userId, to_broadcaster_id: to.id })
    // Twitch's countdown is 90 s; a raid cancelled on Twitch sends nothing, hence the time limit.
    return new Promise((resolve, reject) => {
      const done = (out) => {
        clearTimeout(timer)
        bus.off('twitch.raid.out', sent)
        signal.removeEventListener('abort', aborted)
        out instanceof Error ? reject(out) : resolve(out)
      }
      const sent = (event) => event.to_broadcaster_user_id === to.id && done({ ...data, viewers: event.viewers })
      const aborted = () => {
        cancel().catch(() => {})
        done(null)
      }
      const timer = setTimeout(() => done(new Error('Raid: not sent within 2 minutes (cancelled on Twitch?)')), 120_000)
      bus.on('twitch.raid.out', sent)
      signal.addEventListener('abort', aborted, { once: true })
    })
  },
}
