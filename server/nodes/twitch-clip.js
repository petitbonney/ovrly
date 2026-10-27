// Action: clips the last moments of the stream (while live). Adds { clipId, clipUrl }; Twitch takes a few seconds to
// make the clip, so the URL may not open right away.
import { helix, status } from '../integrations/twitch-auth.js'
import { needStreamer } from '../integrations/twitch.js'

export default {
  type: 'twitch-clip',
  label: 'Create Clip',
  icon: 'scissors',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Clips the last moments of the stream (while live) and adds its URL as {{clipUrl}}.',
  adds: ['clipId', 'clipUrl'],
  config: {},
  async run({ data }) {
    needStreamer('Clips')
    const [clip] = await helix('POST', 'clips', undefined, { broadcaster_id: status.userId })
    return { ...data, clipId: clip.id, clipUrl: `https://clips.twitch.tv/${clip.id}` }
  },
}
