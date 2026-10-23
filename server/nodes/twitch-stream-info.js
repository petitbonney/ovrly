// Action: changes the stream's title, category or tags; the ones left empty stay as they are.
import { helix, status } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill } from '../template.js'

export default {
  type: 'twitch-stream-info',
  label: 'Stream Info',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Changes the stream title, category or tags.',
  fields: {
    title: { vars: true, hint: 'Empty: unchanged' },
    category: { vars: true, hint: 'Named as on Twitch, e.g. Just Chatting; empty: unchanged' },
    tags: { type: 'tags', hint: 'Enter, a space or a comma adds one; none: unchanged', info: 'Up to 10 tags, letters and digits only.' },
  },
  config: { title: '', category: '', tags: '' },
  async run({ config, data }) {
    needStreamer('Stream info')
    const [title, category, tags] = [config.title, config.category, config.tags].map((t) => fill(t, data).trim())
    const body = {}
    if (title) body.title = title
    if (category) {
      const [game] = await helix('GET', 'games', undefined, { name: category })
      if (!game) throw new Error(`Twitch: no category named "${category}"`)
      body.game_id = game.id
    }
    if (tags) body.tags = tags.split(/[+,]/).map((t) => t.trim()).filter(Boolean)
    if (Object.keys(body).length) await helix('PATCH', 'channels', body, { broadcaster_id: status.userId })
    return data
  },
}
