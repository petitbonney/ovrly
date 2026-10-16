// Bets, in one of two modes, both open for the set duration after "open" (or until "close"). Chat bets: viewers bet
// through the "bet" action ("!bet 2", "!bet red"), and "win" reveals who guessed right. Twitch prediction: "open", "close" and "win" run a native Twitch prediction
// with channel points (needs Streamer mode), and its live results come from EventSub; "bet" does nothing.
// Outputs { winner } (the winning option) and { winners } (who bet on it; for a prediction, its top predictors).
import { pick } from '../lib.js'
import { helix } from '../../server/sources/twitch-auth.js'
import { needStreamer } from '../../server/sources/twitch.js'

// Twitch prediction results, per option in order: predictors, channel points and top predictors' names. Events
// about another prediction leave the state as is.
function progress(state, prediction, changes) {
  if (prediction.id !== state.prediction) return state
  const outcomes = state.outcomes.map((id) => prediction.outcomes.find((o) => o.id === id) ?? {})
  return {
    ...state,
    ...changes,
    counts: outcomes.map((o) => o.users ?? 0),
    points: outcomes.map((o) => o.channel_points ?? 0),
    top: outcomes.map((o) => (o.top_predictors ?? []).map((p) => p.user_name)),
  }
}

export default {
  type: 'bets',
  label: 'Bets',
  description: 'Viewers bet on an outcome, by chat or with a Twitch prediction; reveals who guessed right.',
  config: { mode: 'chat', title: 'Who wins?', options: ['Blue', 'Red'], duration: 120 },
  fields: {
    mode: { options: [{ value: 'chat', label: 'Chat bets' }, { value: 'twitch', label: 'Twitch prediction', streamer: true }] },
    duration: { unit: 's', presets: [60, 120, 300, 600], hint: 'How long bets stay open after "open", 30 to 1800 s' },
  },
  // bets: user -> option index (chat bets); counts: bettors per option; endsAt: when bets close (ms); points, top,
  // prediction and outcomes (ids): Twitch prediction only.
  state: { open: false, bets: {}, counts: [], endsAt: 0, points: [], top: [], winner: -1, prediction: '', outcomes: [] },
  adds: ['winner', 'winners'],
  output: (state, config) => ({
    winner: config.options[state.winner] ?? '',
    winners: (state.prediction ? state.top[state.winner] ?? []
      : Object.entries(state.bets).filter(([, i]) => i === state.winner).map(([user]) => user)).join(', '),
  }),
  // Actions that take a value, and what it is.
  inputs: { bet: 'Option number or name, e.g. {{args}}', win: 'The winning option, by number or name' },
  actions: {
    async open(state, input, config) {
      const duration = Math.min(1800, Math.max(30, config.duration))
      const fresh = { open: true, bets: {}, counts: config.options.map(() => 0), endsAt: Date.now() + duration * 1000,
        points: [], top: [], winner: -1, prediction: '', outcomes: [] }
      if (config.mode !== 'twitch') return fresh
      needStreamer('Twitch predictions')
      const [prediction] = await helix('POST', 'predictions', {
        title: config.title.slice(0, 45),
        outcomes: config.options.slice(0, 10).map((o) => ({ title: o.slice(0, 25) })),
        prediction_window: duration,
      })
      return { ...fresh, counts: fresh.counts.slice(0, 10), prediction: prediction.id, outcomes: prediction.outcomes.map((o) => o.id) }
    },
    bet(state, { value, user }, config) {
      const i = pick(config.options, value)
      if (config.mode === 'twitch' || !state.open || Date.now() > state.endsAt || i < 0) return state
      const bets = { ...state.bets, [user]: i }
      return { ...state, bets, counts: config.options.map((o, j) => Object.values(bets).filter((v) => v === j).length) }
    },
    async close(state) {
      if (state.prediction && state.open) await helix('PATCH', 'predictions', { id: state.prediction, status: 'LOCKED' })
      return { ...state, open: false }
    },
    async win(state, { value }, config) {
      const i = pick(config.options, value)
      if (i < 0) return state
      if (state.prediction) await helix('PATCH', 'predictions', { id: state.prediction, status: 'RESOLVED', winning_outcome_id: state.outcomes[i] })
      return { ...state, open: false, winner: i }
    },
  },
  // Twitch prediction results, live (EventSub).
  on: {
    'channel.prediction.progress': (state, prediction) => progress(state, prediction, {}),
    'channel.prediction.lock': (state, prediction) => progress(state, prediction, { open: false }),
    'channel.prediction.end': (state, prediction) =>
      progress(state, prediction, { open: false, winner: state.outcomes.indexOf(prediction.winning_outcome_id) }),
  },
}
