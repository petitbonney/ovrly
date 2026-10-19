// Image/GIF: shows an image for a few seconds, fading in and out. The image is the action's value, set on the node:
// a file path on disk or a URL, typed or from data (e.g. {{gif}} from a GIPHY node).
const imageUrl = (v) =>
  /^(https?:\/\/|\/media\/)/.test(v) ? v : v?.startsWith('/') ? `/file?path=${encodeURIComponent(v)}` : ''

export default {
  type: 'image',
  label: 'Image/GIF',
  description: 'Shows an image or animated GIF (a file on disk or a URL) for a few seconds.',
  config: { duration: 5 },
  fields: {
    duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long the image stays on screen' },
  },
  state: { url: '', at: 0 },
  main: 'show', // what a widget node runs; other actions go through Widget Callback nodes
  inputs: { show: { type: 'image', hint: 'Browse files, or a URL or path, e.g. {{gif}} from a GIPHY node' } },
  playTime: (action, config) => config.duration * 1000 + 600, // in, shown, out; the workflow waits for it
  actions: {
    // A file path is served by /file; a value that isn't an image (e.g. text left in a widget node) shows nothing.
    show: (state, { value }) => ({ url: imageUrl(value), at: Date.now() }),
  },
}
