// Poll: one vote per viewer, by option number or name ("!vote 2", "!vote blue").
import { list, pick } from '../lib.js'

export default {
  type: 'poll',
  label: 'Poll',
  config: { title: 'Poll', options: 'Yes, No' },
  state: { votes: {} }, // user -> option index
  actions: {
    vote(state, { value, user }, config) {
      const i = pick(list(config.options), value)
      return i < 0 ? state : { votes: { ...state.votes, [user]: i } }
    },
    reset: () => ({ votes: {} }),
  },
}
