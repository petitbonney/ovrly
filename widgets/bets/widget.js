// Bets: viewers predict an outcome while bets are open; "win" reveals who guessed right.
import { list, pick } from '../lib.js'

export default {
  type: 'bets',
  label: 'Bets',
  config: { title: 'Who wins?', options: 'Blue, Red' },
  state: { open: false, bets: {}, winner: -1 }, // bets: user -> option index
  actions: {
    open: () => ({ open: true, bets: {}, winner: -1 }),
    bet(state, { value, user }, config) {
      const i = pick(list(config.options), value)
      return !state.open || i < 0 ? state : { ...state, bets: { ...state.bets, [user]: i } }
    },
    close: (state) => ({ ...state, open: false }),
    win(state, { value }, config) {
      const i = pick(list(config.options), value)
      return i < 0 ? state : { ...state, open: false, winner: i }
    },
  },
}
