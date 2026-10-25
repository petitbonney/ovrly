// TwitchPlays: translates chat text into keys to press, through a list of command → keys pairs. "start" makes it listen;
// its widget node runs "push" with each chat message and goes on to a Key Press node set to {{keys}}, which presses
// them. Anarchy passes every command on at once; democracy counts one vote per viewer in loops of the vote window,
// counted from "start", and passes on each loop's winner when it ends. "stop" and "cancel" make it stop listening.
// Outputs { command, keys }.
import { Key } from '@nut-tree-fork/nut-js'

const find = (state, value) => state.commands.findIndex((c) => c.command.trim().toLowerCase() === value.toLowerCase())
// Democracy: the loop under way at `at` (ms), counted from `since`, and when a loop ends. The page has its own copy.
const loopAt = (state, runtime, at) => Math.floor((at - runtime.since) / (state.window * 1000))
const loopEnd = (state, runtime, loop) => runtime.since + (loop + 1) * state.window * 1000
// Stops listening; the votes stay, for the output of the loop "stop" ends.
const off = (runtime) => ({ ...runtime, listening: false })
// Clears the latest commands and the votes ("reset", and "cancel").
const reset = (runtime) => ({ ...runtime, log: [], votes: {}, counts: [], loop: -1 })

export default {
  type: 'twitch-plays',
  label: 'TwitchPlays',
  icon: 'device-gamepad-2',
  description: 'Translates chat commands into keys to press, by anarchy or democracy.',
  state: {
    mode: 'anarchy',
    title: 'Twitch Plays',
    commands: [
      { command: 'up', keys: 'Up' },
      { command: 'down', keys: 'Down' },
      { command: 'left', keys: 'Left' },
      { command: 'right', keys: 'Right' },
      { command: 'a', keys: 'X' },
      { command: 'b', keys: 'Z' },
      { command: 'start', keys: 'Enter' },
    ],
    window: 5,
    max: 8,
  },
  fields: {
    mode: { options: [{ value: 'anarchy', label: 'Anarchy' }, { value: 'democracy', label: 'Democracy' }] },
    title: {},
    commands: {
      hint: 'A chat message that is exactly a command presses its keys',
      info: 'In any case. A command\'s keys are pressed together.',
      columns: { keys: { type: 'tags', options: Object.keys(Key).filter((k) => isNaN(k)) } },
    },
    window: {
      label: 'Vote window', unit: 's', presets: [3, 5, 10, 20], only: { mode: 'democracy' }, hint: 'Votes are counted in loops this long, from start',
      info: "Each loop's most voted command goes on (a tie: the first in the list).",
    },
    max: { label: 'Inputs shown', only: { mode: 'anarchy' } },
  },
  // listening: between "start" and "stop" or "cancel"; since: when the loops began (ms); loop: the loop the votes are
  // for (-1: none, e.g. in anarchy); log: latest commands, newest first, { user, command, at }; votes: user -> command
  // index; counts: votes per command.
  runtime: { listening: false, since: 0, loop: -1, log: [], votes: {}, counts: [] },
  adds: ['command', 'keys'],
  onSignal: 'push', // its widget node runs "push" with each chat message
  // Anarchy: the command just pushed. Democracy: the loop's leader, which is the winner for the last vote's run (the
  // only one left when the loop ends).
  output({ state, runtime }) {
    const top = Math.max(0, ...runtime.counts)
    const i = runtime.loop >= 0 ? (top ? runtime.counts.indexOf(top) : -1) : find(state, runtime.log[0]?.command ?? '')
    return { command: state.commands[i]?.command ?? '', keys: state.commands[i]?.keys ?? '' }
  },
  // Democracy: each vote's run waits until its loop ends; the next vote replaces it, so only the last one goes on.
  playTime: (action, { state, runtime }) => (action === 'push' && runtime.loop >= 0 ? Math.max(0, loopEnd(state, runtime, runtime.loop) - Date.now()) : 0),
  actions: {
    start: {
      description: 'Starts listening, in the Mode setting; in democracy, the first loop begins.',
      run: ({ runtime }) => ({ runtime: { ...runtime, listening: true, since: Date.now(), loop: -1, votes: {}, counts: [] } }),
    },
    push: {
      description: "A chat message, while listening. Anarchy: a command goes on at once, with {{command}} and {{keys}}. Democracy: it is a vote, and the loop's winner goes on when the loop ends. Anything else stops there.",
      inputs: { text: { vars: true, hint: 'The chat text, e.g. {{message}}' }, user: { vars: true, default: '{{user}}', hint: 'Who sent it' } },
      run({ state, runtime, input: { text, user } }) {
        const i = find(state, text)
        if (!runtime.listening || i < 0) return
        const log = [{ user, command: state.commands[i].command, at: Date.now() }, ...runtime.log].slice(0, state.max)
        if (state.mode === 'anarchy') return { runtime: { ...runtime, log, loop: -1, votes: {}, counts: [] } }
        const loop = loopAt(state, runtime, Date.now())
        const votes = { ...(loop === runtime.loop ? runtime.votes : {}), [user]: i } // a new loop starts over
        const counts = state.commands.map((c, j) => Object.values(votes).filter((v) => v === j).length)
        return { runtime: { ...runtime, log, votes, counts, loop } }
      },
    },
    mode: {
      description: 'Switches the Mode setting to anarchy or democracy; the vote under way, if any, is dropped and a new loop begins.',
      inputs: { mode: { vars: true, hint: 'anarchy or democracy' } },
      run({ state, runtime, input }) {
        const next = input.mode.toLowerCase()
        if (!['anarchy', 'democracy'].includes(next) || next === state.mode) return
        return { state: { ...state, mode: next }, runtime: { ...runtime, since: Date.now(), loop: -1, votes: {}, counts: [] } }
      },
    },
    reset: {
      description: 'Clears the latest commands and the votes; the vote under way, if any, is dropped.',
      run: ({ runtime }) => ({ runtime: reset(runtime) }),
    },
    stop: { description: 'Stops listening; in democracy, the loop under way ends now and its winner goes on.', run: ({ runtime }) => ({ runtime: off(runtime) }) },
    cancel: { description: 'Stops listening, and clears the latest commands and the votes; the vote under way is dropped.', run: ({ runtime }) => ({ runtime: reset(off(runtime)) }) },
  },
}
