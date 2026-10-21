// Image/GIF: shows an image for a few seconds, fading in and out. The image is the action's input, set on the node:
// a file path on disk or a URL, typed or from data (e.g. {{gif}} from a GIPHY node).
const ABS = /^([a-z]:[\\/]|[\\/])/i // C:\..., \\server\..., or /...
const imageUrl = (v) =>
  /^(https?:\/\/|\/media\/)/.test(v) ? v : v && ABS.test(v) ? `/file?path=${encodeURIComponent(v)}` : ''

export default {
  type: 'image',
  label: 'Image/GIF',
  description: 'Shows an image or animated GIF (a file on disk or a URL) for a few seconds.',
  config: { duration: 5 },
  fields: {
    duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long the image stays on screen' },
  },
  state: { url: '', at: 0 },
  main: 'show', // what a widget node runs; other actions go through Widget Action nodes
  inputs: { show: { image: { type: 'image', hint: 'Browse files, or a URL or path, e.g. {{gif}} from a GIPHY node' } } },
  playTime: (action, config) => config.duration * 1000 + 600, // in, shown, out; the workflow waits for it
  actions: {
    // A file path is served by /file; an input that isn't an image (e.g. text left in a widget node) shows nothing.
    show: (state, { image }) => ({ url: imageUrl(image), at: Date.now() }),
  },
}
