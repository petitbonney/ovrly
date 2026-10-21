// TwitchPlays: translates chat text into keys to press, through a list of command → keys pairs. Pair it with a Key
// Press node set to {{keys}}, which presses them. Anarchy passes every command on at once; democracy counts one vote
// per viewer for the vote window, then passes on the winner. Outputs { command, keys }.
import { Key } from '@nut-tree-fork/nut-js'

// The "mode" action overrides the Mode setting until a restart, or until the setting changes (over: the one it overrode).
const mode = (state, config) => (state.mode && state.over === config.mode ? state.mode : config.mode)
const find = (config, value) => config.commands.findIndex((c) => c.command.trim().toLowerCase() === value.toLowerCase())

export default {
  type: 'twitch-plays',
  label: 'TwitchPlays',
  description: 'Translates chat commands into keys to press, by anarchy or democracy.',
  config: {
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
    commands: {
      hint: 'A chat message that is exactly a command (any case) gives its keys, pressed together',
      columns: { keys: { type: 'keys', options: Object.keys(Key).filter((k) => isNaN(k)) } },
    },
    window: { label: 'Vote window', unit: 's', presets: [3, 5, 10, 20], only: { mode: 'democracy' }, hint: 'Opens with the first vote; the most voted command wins (a tie: the first in the list)' },
    max: { label: 'Inputs shown', only: { mode: 'anarchy' } },
  },
  // mode, over: set by the "mode" action (see mode()); log: latest commands, newest first, { user, command, at };
  // votes: user -> command index; endsAt: when the vote closes (ms); counts: votes per command.
  state: { mode: '', over: '', log: [], votes: {}, counts: [], endsAt: 0 },
  adds: ['command', 'keys'],
  // Anarchy: the command just pushed. Democracy: the leader so far, which is the winner for the last vote's run (the
  // only one left when the window closes).
  output(state, config) {
    const top = Math.max(0, ...state.counts)
    const i = mode(state, config) === 'democracy' ? (top ? state.counts.indexOf(top) : -1) : find(config, state.log[0]?.command ?? '')
    return { command: config.commands[i]?.command ?? '', keys: config.commands[i]?.keys ?? '' }
  },
  main: 'push', // what a widget node runs; other actions go through Widget Action nodes
  inputs: {
    push: { text: { vars: true, hint: 'The chat text, e.g. {{message}}' }, user: { vars: true, default: '{{user}}', hint: 'Who sent it' } },
    mode: { mode: { vars: true, hint: 'anarchy or democracy' } },
  },
  // Democracy: each vote's run waits until the window closes; the next vote cancels it, so only the last one goes on.
  playTime: (action, config, state) => (action === 'push' && mode(state, config) === 'democracy' ? Math.max(0, state.endsAt - Date.now()) : 0),
  actions: {
    // Anything that isn't a command does nothing (the run stops there).
    push(state, { text, user }, config) {
      const i = find(config, text)
      if (i < 0) return state
      const log = [{ user, command: config.commands[i].command, at: Date.now() }, ...state.log].slice(0, config.max)
      if (mode(state, config) === 'anarchy') return { ...state, log }
      const now = Date.now()
      const fresh = now >= state.endsAt // the last vote is over: this one opens a new window
      const votes = { ...(fresh ? {} : state.votes), [user]: i }
      const counts = config.commands.map((c, j) => Object.values(votes).filter((v) => v === j).length)
      return { ...state, log, votes, counts, endsAt: fresh ? now + config.window * 1000 : state.endsAt }
    },
    // Switches mode; the vote under way, if any, is dropped (this action cancels its run).
    mode(state, input, config) {
      const next = input.mode.toLowerCase()
      if (!['anarchy', 'democracy'].includes(next) || next === mode(state, config)) return state
      return { ...state, mode: next, over: config.mode, votes: {}, counts: [], endsAt: 0 }
    },
    reset: (state) => ({ ...state, log: [], votes: {}, counts: [], endsAt: 0 }),
  },
}
