// TwitchPlays: shows the latest chat inputs; pair it with key-press nodes to send them to the game.
export default {
  type: 'twitch-plays',
  label: 'TwitchPlays',
  description: 'Shows the latest chat inputs, to pair with key presses for a game.',
  soon: true, // coming soon: shown in the library, its settings are not ready yet
  config: { title: 'Twitch Plays', max: 8 },
  state: { log: [] }, // newest first: { user, value }
  main: 'push', // what a widget node runs; other actions go through Widget Callback nodes
  inputs: { push: 'The input to show, e.g. {{message}}' }, // actions that take a value, and what it is
  actions: {
    push: (state, { value, user }, config) => ({ log: [{ user, value }, ...state.log].slice(0, config.max) }),
    reset: () => ({ log: [] }),
  },
}
