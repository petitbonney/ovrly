// Poll, in one of two modes, both open for the set duration after "start". Chat votes: one vote per viewer through the
// "vote" action ("!vote 2", "!vote blue"), counted here. Twitch poll: "start" runs a native Twitch poll (needs Streamer mode) and its live results come from
// EventSub; "vote" does nothing. Outputs { leader } (the option with the most votes) and { votes } (the vote count).
import { pick } from '../lib.js'
import { helix } from '../../server/sources/twitch-auth.js'
import { needStreamer } from '../../server/sources/twitch.js'

// Twitch poll results: one vote count per option, in order. Events about another poll leave the state as is.
const progress = (state, poll, open) => poll.id !== state.poll ? state
  : { ...state, open, counts: poll.choices.map((c) => c.votes) }

export default {
  type: 'poll',
  label: 'Poll',
  description: 'Viewers vote for an option, by chat or with a Twitch poll; shows the results live.',
  config: { mode: 'chat', title: 'Poll', options: ['Yes', 'No'], duration: 60 },
  fields: {
    mode: { options: [{ value: 'chat', label: 'Chat votes' }, { value: 'twitch', label: 'Twitch poll', streamer: true }] },
    duration: { unit: 's', presets: [30, 60, 120, 300], hint: 'How long voting stays open after "start", 15 to 1800 s' },
  },
  // votes: user -> option index (chat votes); counts: votes per option; endsAt: when voting closes (ms, 0 = never: chat
  // votes before any "start"); poll: the Twitch poll's id.
  state: { open: true, votes: {}, counts: [], endsAt: 0, poll: '' },
  adds: ['leader', 'votes'],
  output(state, config) {
    const top = Math.max(0, ...state.counts)
    return { leader: top ? config.options[state.counts.indexOf(top)] : '', votes: state.counts.reduce((a, b) => a + b, 0) }
  },
  inputs: { vote: 'Option number or name, e.g. {{args}}' }, // actions that take a value, and what it is
  actions: {
    // Clears the votes and opens voting for the duration.
    async start(state, input, config) {
      const zeros = config.options.map(() => 0)
      const duration = Math.min(1800, Math.max(15, config.duration))
      const endsAt = Date.now() + duration * 1000
      if (config.mode !== 'twitch') return { open: true, votes: {}, counts: zeros, endsAt, poll: '' }
      needStreamer('Twitch polls')
      const [poll] = await helix('POST', 'polls', {
        title: config.title.slice(0, 60),
        choices: config.options.slice(0, 5).map((o) => ({ title: o.slice(0, 25) })),
        duration,
      })
      return { open: true, votes: {}, counts: zeros.slice(0, 5), endsAt, poll: poll.id }
    },
    vote(state, { value, user }, config) {
      const i = pick(config.options, value)
      const late = state.endsAt && Date.now() > state.endsAt
      if (config.mode === 'twitch' || !state.open || late || i < 0) return state
      const votes = { ...state.votes, [user]: i }
      return { ...state, votes, counts: config.options.map((o, j) => Object.values(votes).filter((v) => v === j).length) }
    },
    async end(state, input, config) {
      if (config.mode === 'twitch' && state.poll && state.open) await helix('PATCH', 'polls', { id: state.poll, status: 'TERMINATED' })
      return { ...state, open: false }
    },
  },
  // Twitch poll results, live (EventSub).
  on: {
    'channel.poll.progress': (state, poll) => progress(state, poll, true),
    'channel.poll.end': (state, poll) => progress(state, poll, false),
  },
}
