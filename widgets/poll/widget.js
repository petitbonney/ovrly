// Poll: one vote per viewer, by option number or name ("!vote 2", "!vote blue").
// Outputs { leader } (the option with the most votes) and { votes } (the vote count).
import { pick } from '../lib.js'

export default {
  type: 'poll',
  label: 'Poll',
  description: 'One vote per viewer by option number or name; shows the results live.',
  soon: true, // coming soon: shown in the library, its settings are not ready yet
  config: { title: 'Poll', options: ['Yes', 'No'] },
  state: { votes: {} }, // user -> option index
  adds: ['leader', 'votes'],
  output(state, config) {
    const counts = config.options.map((option, i) => Object.values(state.votes).filter((v) => v === i).length)
    const top = Math.max(0, ...counts)
    return { leader: top ? config.options[counts.indexOf(top)] : '', votes: Object.keys(state.votes).length }
  },
  inputs: { vote: 'Option number or name, e.g. {{args}}' }, // actions that take a value, and what it is
  actions: {
    vote(state, { value, user }, config) {
      const i = pick(config.options, value)
      return i < 0 ? state : { votes: { ...state.votes, [user]: i } }
    },
    reset: () => ({ votes: {} }),
  },
}
