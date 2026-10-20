// Sound: plays a sound through the overlay page (an OBS browser source, so it reaches the stream), up to a max duration.
// The sound is the action's value, set on the node: a file path on disk or a URL, typed or from data (e.g. {{sound}} from a MyInstants node).
const ABS = /^([a-z]:[\\/]|[\\/])/i // C:\..., \\server\..., or /...
const soundUrl = (v) =>
  /^https?:\/\//.test(v) ? v : v && ABS.test(v) ? `/file?path=${encodeURIComponent(v)}` : ''

export default {
  type: 'sound',
  label: 'Sound',
  description: 'Plays a sound (a file on disk or a URL), up to a max duration.',
  visual: false, // nothing to see: no preview in its settings, no box on a Merge Widgets canvas
  config: { duration: 0, volume: 100 },
  fields: {
    duration: { label: 'Max duration', unit: 's', presets: [5, 10, 15, 30], hint: 'The sound is cut (with a short fade-out) after this long; 0 plays all of it' },
    volume: { unit: '%', hint: 'Myinstants sounds are often loud' },
  },
  state: { url: '' },
  main: 'play',
  // No playTime: the server can't know a sound's length, so the page tells when it has ended (or been cut).
  inputs: { play: { type: 'sound', hint: 'Browse files, or a URL or path, e.g. {{sound}} from a MyInstants node' } },
  actions: {
    // A value that isn't a sound (e.g. text left in a widget node) plays nothing.
    play: (state, { value }) => ({ url: soundUrl(value) }),
  },
}
