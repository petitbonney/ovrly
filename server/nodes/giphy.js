// Action: adds { giphyUrl, giphyTitle }: the URL of a GIF, sticker or clip (a GIF with sound) picked in the editor, or a
// random one found by a search run each time (empty: trending), e.g. for an Image/GIF widget (a Video widget for a clip).
// Uses the Giphy API key (Settings → Giphy).
import { fill } from '../template.js'
import * as giphy from '../integrations/giphy.js'

export default {
  type: 'giphy',
  label: 'GIPHY',
  icon: 'gif',
  category: 'action',
  group: 'Media',
  play: { only: { pick: 'random' } },
  needs: ['giphy'],
  description: 'Finds a GIF, sticker or clip (with sound) on Giphy and adds its URL as {{giphyUrl}}.',
  adds: { giphyUrl: 'URL of the GIF, sticker or clip', giphyTitle: 'Its title (empty when picked)' },
  fields: {
    kind: {
      label: 'Type', options: [{ value: 'gif', label: 'GIF' }, { value: 'sticker', label: 'Sticker' }, { value: 'clip', label: 'Clip' }],
      info: 'Sticker: a GIF with a transparent background. Clip: a GIF with sound, for the Video widget (needs a Giphy key approved for clips).',
    },
    rating: {
      options: ['g', 'pg', 'pg-13', 'r'],
      slider: true,
      tips: {
        g: 'Suitable for all ages: no profanity, violence or suggestive content',
        pg: 'Mild content: light innuendo, mild language, cartoon violence',
        'pg-13': 'Moderate content: stronger language, some violence or suggestive themes',
        r: 'Mature content: strong language, violence, drugs or sexual themes',
      },
      hint: 'The most mature rating allowed',
    },
    pick: { options: ['picked', 'random'], hint: 'Picked: one chosen here. Random: from a search, each time' },
    picked: { type: 'giphy', label: 'Picked GIF', only: { pick: 'picked', kind: 'gif' } },
    pickedSticker: { type: 'giphy', media: 'sticker', label: 'Picked sticker', only: { pick: 'picked', kind: 'sticker' } },
    pickedClip: { type: 'giphy', media: 'clip', label: 'Picked clip', only: { pick: 'picked', kind: 'clip' } },
    search: { only: { pick: 'random' }, vars: true, hint: 'e.g. {{message}}; empty for a trending one' },
  },
  config: { kind: 'gif', pick: 'picked', picked: '', pickedSticker: '', pickedClip: '', search: 'hype', rating: 'pg' },
  async run({ config, data }) {
    const kind = config.kind ?? 'gif'
    if (config.pick === 'picked') {
      const url = { gif: config.picked, sticker: config.pickedSticker, clip: config.pickedClip }[kind]
      if (!url) throw new Error(`GIPHY: pick a ${kind} first`)
      return { ...data, giphyUrl: url, giphyTitle: '' }
    }
    const q = fill(config.search, data).trim()
    const list = await giphy.search(q, 0, kind, config.rating)
    const found = list[Math.floor(Math.random() * list.length)]
    if (!found) throw new Error(`GIPHY: no ${kind} found for "${q}"`)
    return { ...data, giphyUrl: found.url, giphyTitle: found.title }
  },
}
