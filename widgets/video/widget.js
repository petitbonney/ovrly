// Video: plays a short video through the overlay page (an OBS browser source), up to a max duration.
// The video is the action's input, set on the node: a file path on disk or a URL, typed or from data.
export const FADE = 300 // ms: the video fading out at its end, or on "stop"
const ABS = /^([a-z]:[\\/]|[\\/])/i // C:\..., \\server\..., or /...
const videoUrl = (v) =>
  /^https?:\/\//.test(v) ? v : v && ABS.test(v) ? `/file?path=${encodeURIComponent(v)}` : ''

export default {
  type: 'video',
  label: 'Video',
  description: 'Plays a short video (a file on disk or a URL), up to a max duration.',
  config: { duration: 0, volume: 100 },
  fields: {
    duration: { label: 'Max duration', unit: 's', presets: [5, 10, 15, 30], hint: 'Cut with a short fade-out; 0 plays all of it' },
    volume: { unit: '%', slider: true },
  },
  state: { url: '' },
  // No playTime: the server can't know a video's length, so the page tells when it has ended (or been cut).
  stopTime: () => FADE,
  actions: {
    start: {
      description: 'Plays the video, up to the max duration; the workflow goes on once it has ended.',
      inputs: { video: { type: 'video', hint: 'Browse files, or a URL or path (mp4 or webm)' } },
      // An input that isn't a video (e.g. text left in a widget node) plays nothing.
      run: (state, { video }) => ({ url: videoUrl(video) }),
    },
    stop: { description: 'The video fades out now; the workflow goes on.' },
    cancel: { description: 'The video is cut at once; the workflow stops there.' },
  },
}
