// Bets: viewers predict an outcome while bets are open; "win" reveals who guessed right.
// Outputs { winner } (the winning option) and { winners } (the users who bet on it, comma-separated).
import { list, pick } from '../lib.js'

export default {
  type: 'bets',
  label: 'Bets',
  config: { title: 'Who wins?', options: 'Blue, Red' },
  state: { open: false, bets: {}, winner: -1 }, // bets: user -> option index
  adds: ['winner', 'winners'],
  output: (state, config) => ({
    winner: list(config.options)[state.winner] ?? '',
    winners: Object.entries(state.bets).filter(([, i]) => i === state.winner).map(([user]) => user).join(', '),
  }),
  // Actions that take a value, and what it is.
  inputs: { bet: 'Option number or name, e.g. {args}', win: 'The winning option, by number or name' },
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
