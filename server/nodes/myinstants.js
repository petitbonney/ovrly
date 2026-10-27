// Action: adds { sound, title }: the URL of a sound picked in the editor, or a random one found by a search run each time,
// e.g. for a Sound widget's {{sound}}.
import { fill } from '../template.js'
import * as myinstants from '../integrations/myinstants.js'

export default {
  type: 'myinstants',
  label: 'MyInstants',
  icon: 'speakerphone',
  category: 'action',
  group: 'Media',
  play: { only: { pick: 'random' } },
  description: 'Finds a sound on Myinstants and adds its URL as {{sound}}.',
  adds: ['sound', 'title'],
  fields: {
    pick: { options: ['picked', 'random'], hint: 'picked: one chosen here; random: one of a search run each time' },
    picked: { type: 'myinstants', label: 'Picked sound', only: { pick: 'picked' } },
    search: { only: { pick: 'random' }, vars: true, hint: 'e.g. {{message}}; empty for a trending sound' },
  },
  config: { pick: 'picked', picked: '', search: 'airhorn' },
  async run({ config, data }) {
    if (config.pick === 'picked') {
      if (!config.picked) throw new Error('MyInstants: pick a sound first')
      return { ...data, sound: config.picked, title: '' }
    }
    const q = fill(config.search, data).trim()
    const list = await myinstants.search(q, 1)
    const found = list[Math.floor(Math.random() * list.length)]
    if (!found) throw new Error(`MyInstants: no sound found for "${q}"`)
    return { ...data, sound: found.url, title: found.title }
  },
}
