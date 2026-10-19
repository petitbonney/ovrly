// Action: adds { gif, title }: the URL of a GIF picked in the editor, or a random one found by a search run each time (empty:
// trending), e.g. for an Image/GIF widget's {{gif}}. Uses the Integration → Giphy API key.
import { fill } from '../template.js'
import * as giphy from '../giphy.js'

export default {
  type: 'giphy',
  label: 'GIPHY',
  category: 'action',
  description: 'Finds a GIF on Giphy and adds its URL as {{gif}}.',
  adds: ['gif', 'title'],
  fields: {
    pick: { options: ['picked', 'random'], hint: 'picked: one chosen here; random: one of a search run each time' },
    picked: { type: 'giphy', label: 'Picked GIF', only: { pick: 'picked' } },
    search: { only: { pick: 'random' }, vars: true, hint: 'e.g. {{message}}; empty for a trending GIF' },
  },
  config: { pick: 'picked', picked: '', search: 'hype' },
  async run({ config, data }) {
    if (config.pick === 'picked') {
      if (!config.picked) throw new Error('GIPHY: pick a GIF first')
      return { ...data, gif: config.picked, title: '' }
    }
    const q = fill(config.search, data).trim()
    const list = await giphy.search(q, 0)
    const found = list[Math.floor(Math.random() * list.length)]
    if (!found) throw new Error(`GIPHY: no GIF found for "${q}"`)
    return { ...data, gif: found.url, title: found.title }
  },
}
