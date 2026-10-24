// Voting: a poll (viewers vote, the most voted option leads) or a prediction (viewers bet, "win" reveals who guessed
// right), open for the set duration after "start" (or until "stop" or "cancel"). Chat mode: viewers vote through the
// "vote" action ("!vote 2", "!vote red"), one vote per viewer, counted here. Twitch mode (Streamer mode): "start",
// "stop", "cancel" and "win" run a native Twitch poll or prediction (channel points), its live results come from
// EventSub, and there is no "vote". The "start" run waits until voting ends (its time is up, or "stop").
// Outputs { winner } (the poll's leader or the prediction's outcome), { votes } (how many voted) and { winners } (who
// bet on the outcome; for a Twitch prediction, its top predictors).
import { pick } from '../lib.js'
import { helix } from '../../server/sources/twitch-auth.js'
import { needStreamer } from '../../server/sources/twitch.js'

const poll = (state) => state.kind !== 'prediction'
const leader = (counts) => (Math.max(0, ...counts) ? counts.indexOf(Math.max(...counts)) : -1)

// Twitch results, per option in order: voters, channel points and top predictors' names. Events about another poll or
// prediction leave the runtime as is.
function progress(runtime, event, changes) {
  if (event.id !== runtime.twitch) return runtime
  const choices = runtime.ids.map((id) => (event.choices ?? event.outcomes).find((c) => c.id === id) ?? {})
  return {
    ...runtime,
    ...changes,
    counts: choices.map((c) => c.votes ?? c.users ?? 0),
    points: choices.map((c) => c.channel_points ?? c.channel_points_votes ?? 0),
    top: choices.map((c) => (c.top_predictors ?? []).map((p) => p.user_name)),
  }
}

// Ends voting early: ends the Twitch poll, or locks the Twitch prediction (no more bets, still to be won).
async function close({ state, runtime }) {
  if (!runtime.open) return
  if (!runtime.twitch || Date.now() >= runtime.endsAt) return { runtime: { ...runtime, open: false } }
  const [vote] = poll(state)
    ? await helix('PATCH', 'polls', { id: runtime.twitch, status: 'TERMINATED' })
    : await helix('PATCH', 'predictions', { id: runtime.twitch, status: 'LOCKED' })
  return { runtime: progress(runtime, vote, { open: false }) }
}

export default {
  type: 'voting',
  label: 'Voting',
  description: 'A poll or a prediction, by chat or with Twitch; shows the results live and who guessed right.',
  state: { kind: 'poll', mode: 'chat', title: 'Who wins?', options: ['Yes', 'No'], duration: 60 },
  fields: {
    kind: { label: 'Vote', options: [{ value: 'poll', label: 'Poll' }, { value: 'prediction', label: 'Prediction' }] },
    mode: { options: [{ value: 'chat', label: 'Chat' }, { value: 'twitch', label: 'Twitch', streamer: true }] },
    title: {},
    options: { hint: 'Twitch takes 2 to 5 (poll) or 2 to 10 (prediction)', info: 'A Twitch poll takes 2 to 5 options, a prediction 2 to 10, each up to 25 characters.' },
    duration: { unit: 's', presets: [30, 60, 120, 300], hint: 'How long voting stays open after "start", 30 to 1800 s' },
  },
  // votes: user -> option index (chat); counts: voters per option; endsAt: when voting closes (ms); winner: the
  // prediction's outcome; twitch, ids: the Twitch poll or prediction and its options' ids; points, top: Twitch only.
  runtime: { open: false, votes: {}, counts: [], endsAt: 0, winner: -1, twitch: '', ids: [], points: [], top: [] },
  adds: ['winner', 'votes', 'winners'],
  output({ state, runtime }) {
    const i = poll(state) ? leader(runtime.counts) : runtime.winner
    const winners = runtime.twitch ? runtime.top[i] ?? [] : Object.keys(runtime.votes).filter((user) => runtime.votes[user] === i)
    return { winner: state.options[i] ?? '', votes: runtime.counts.reduce((a, b) => a + b, 0), winners: winners.join(', ') }
  },
  // "start" plays while voting is open; a Twitch vote, until Twitch says it is over (its final results), 10s late at most.
  playTime: (action, { runtime }) => (action !== 'start' ? 0 : Math.max(0, runtime.endsAt - Date.now()) + (runtime.twitch ? 10_000 : 0)),
  queues: (action) => action !== 'start', // votes and "win" don't replace the open vote; a new "start" does
  over: ({ runtime }) => !runtime.open,
  actions: {
    start: {
      description: 'Clears the votes and opens voting for the set duration (in Twitch mode, a Twitch poll or prediction); the workflow goes on once voting has ended, with {{winner}}, {{votes}} and {{winners}}.',
      async run({ state }) {
        const duration = Math.min(1800, Math.max(30, state.duration))
        const fresh = { open: true, votes: {}, counts: state.options.map(() => 0), endsAt: Date.now() + duration * 1000,
          winner: -1, twitch: '', ids: [], points: [], top: [] }
        if (state.mode !== 'twitch') return { runtime: fresh }
        const options = state.options.slice(0, poll(state) ? 5 : 10).map((o) => ({ title: o.slice(0, 25) }))
        needStreamer(poll(state) ? 'Twitch polls' : 'Twitch predictions')
        const [vote] = poll(state)
          ? await helix('POST', 'polls', { title: state.title.slice(0, 60), choices: options, duration })
          : await helix('POST', 'predictions', { title: state.title.slice(0, 45), outcomes: options, prediction_window: duration })
        const ids = (vote.choices ?? vote.outcomes).map((c) => c.id)
        return { runtime: { ...fresh, counts: ids.map(() => 0), twitch: vote.id, ids } }
      },
    },
    vote: {
      description: "Counts a viewer's vote while voting is open; a new vote from the same viewer replaces theirs.",
      only: { mode: 'chat' },
      inputs: { option: { vars: true, hint: 'Option number or name, e.g. {{args}}' }, user: { vars: true, default: '{{user}}', hint: 'Who votes' } },
      run({ state, runtime, input: { option, user } }) {
        const i = pick(state.options, option)
        if (runtime.twitch || state.mode === 'twitch' || !runtime.open || Date.now() > runtime.endsAt || i < 0) return
        const votes = { ...runtime.votes, [user]: i }
        return { runtime: { ...runtime, votes, counts: state.options.map((o, j) => Object.values(votes).filter((v) => v === j).length) } }
      },
    },
    win: {
      description: 'Reveals the outcome of the prediction (a Twitch prediction pays out its channel points).',
      only: { kind: 'prediction' },
      inputs: { option: { vars: true, hint: 'The winning option, by number or name' } },
      async run({ state, runtime, input: { option } }) {
        const i = pick(state.options, option)
        if (poll(state) || i < 0 || runtime.winner >= 0) return
        if (!runtime.twitch) return { runtime: { ...runtime, open: false, winner: i } }
        const [vote] = await helix('PATCH', 'predictions', { id: runtime.twitch, status: 'RESOLVED', winning_outcome_id: runtime.ids[i] })
        return { runtime: progress(runtime, vote, { open: false, winner: i }) }
      },
    },
    stop: {
      description: 'Ends voting now (ends the Twitch poll, or locks the Twitch prediction, still to be won); the workflow goes on with the results.',
      run: close,
    },
    cancel: { description: 'Ends voting now, as stop does; the workflow stops there.', run: close },
  },
  // Twitch results, live (EventSub).
  on: {
    'channel.poll.progress': ({ runtime }, event) => ({ runtime: progress(runtime, event, {}) }),
    'channel.poll.end': ({ runtime }, event) => ({ runtime: progress(runtime, event, { open: false }) }),
    'channel.prediction.progress': ({ runtime }, event) => ({ runtime: progress(runtime, event, {}) }),
    'channel.prediction.lock': ({ runtime }, event) => ({ runtime: progress(runtime, event, { open: false }) }),
    'channel.prediction.end': ({ runtime }, event) => ({ runtime: progress(runtime, event, { open: false, winner: runtime.ids.indexOf(event.winning_outcome_id) }) }),
  },
}
