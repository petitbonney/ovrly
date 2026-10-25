// Action: posts a chat announcement: a message highlighted in a color, as the streamer.
import { helix, channel } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

const colors = [
  { value: 'primary', label: 'Channel color' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
]

export default {
  type: 'twitch-announce',
  label: 'Announcement',
  icon: 'message-star',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Posts a chat announcement: a message highlighted in a color.',
  fields: { message: { vars: true, multiline: true, hint: 'Up to 500 characters' }, color: { options: colors } },
  config: { message: '', color: 'primary' },
  async run({ config, data }) {
    needStreamer('Announcements')
    await helix('POST', 'chat/announcements', { message: fill(config.message, data), color: config.color }, channel())
    return data
  },
}
