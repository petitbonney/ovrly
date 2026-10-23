// Image/GIF: shows an image for a few seconds, fading in and out. The image is the action's input, set on the node:
// a file path on disk or a URL, typed or from data (e.g. {{gif}} from a GIPHY node).
const ABS = /^([a-z]:[\\/]|[\\/])/i // C:\..., \\server\..., or /...
const imageUrl = (v) =>
  /^https?:\/\//.test(v) ? v : v && ABS.test(v) ? `/file?path=${encodeURIComponent(v)}` : ''
export const FADE = 300 // ms: the image fading in, and out

export default {
  type: 'image',
  label: 'Image/GIF',
  description: 'Shows an image or animated GIF (a file on disk or a URL) for a few seconds.',
  config: { duration: 5 },
  fields: {
    duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long the image stays on screen' },
  },
  state: { url: '', at: 0 },
  playTime: (action, config) => config.duration * 1000 + 2 * FADE, // in, shown, out; the workflow waits for it
  stopTime: () => FADE,
  actions: {
    start: {
      description: 'Shows the image for the set duration, fading in and out; the workflow goes on once it has gone.',
      inputs: { image: { type: 'image', hint: 'Browse files, or a URL or path, e.g. {{gif}} from a GIPHY node' } },
      // A file path is served by /file; an input that isn't an image (e.g. text left in a widget node) shows nothing.
      run: (state, { image }) => ({ url: imageUrl(image), at: Date.now() }),
    },
    stop: { description: 'The image fades out now; the workflow goes on.' },
    cancel: { description: 'The image disappears at once; the workflow stops there.' },
  },
}
