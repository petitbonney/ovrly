// Action: adds a stream marker (while live), to find the moment again in the VOD.
import { helix, status } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-marker',
  label: 'Stream Marker',
  category: 'action',
  group: 'Twitch',
  streamer: true,
  description: 'Adds a stream marker (while live), to find the moment again in the VOD.',
  fields: { description: { vars: true, hint: 'Up to 140 characters, e.g. {{user}} cheered {{bits}} bits' } },
  config: { description: '' },
  async run({ config, data }) {
    needStreamer('Stream markers')
    // This endpoint names the channel user_id: no broadcaster_id in the body (empty query).
    await helix('POST', 'streams/markers', { user_id: status.userId, description: fill(config.description, data).slice(0, 140) }, {})
    return data
  },
}
