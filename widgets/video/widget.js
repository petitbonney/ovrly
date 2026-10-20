// Video: plays a short video through the overlay page (an OBS browser source), up to a max duration.
// The video is the action's value, set on the node: a file path on disk or a URL, typed or from data.
const ABS = /^([a-z]:[\\/]|[\\/])/i // C:\..., \\server\..., or /...
const videoUrl = (v) =>
  /^https?:\/\//.test(v) ? v : v && ABS.test(v) ? `/file?path=${encodeURIComponent(v)}` : ''

export default {
  type: 'video',
  label: 'Video',
  description: 'Plays a short video (a file on disk or a URL), up to a max duration.',
  config: { duration: 0, volume: 100 },
  fields: {
    duration: { label: 'Max duration', unit: 's', presets: [5, 10, 15, 30], hint: 'The video is cut (with a short fade-out) after this long; 0 plays all of it' },
    volume: { unit: '%', slider: true },
  },
  state: { url: '' },
  main: 'play',
  // No playTime: the server can't know a video's length, so the page tells when it has ended (or been cut).
  inputs: { play: { type: 'video', hint: 'Browse files, or a URL or path (mp4 or webm)' } },
  actions: {
    // A value that isn't a video (e.g. text left in a widget node) plays nothing.
    play: (state, { value }) => ({ url: videoUrl(value) }),
  },
}
