// Image/GIF: shows an image for a few seconds, fading in and out. The image is the action's value, set on the node:
// uploaded, picked from Giphy, or a URL (e.g. {{image}} from a previous node).
export default {
  type: 'image',
  label: 'Image/GIF',
  description: 'Shows an image or animated GIF (uploaded or from Giphy) for a few seconds.',
  config: { duration: 5 },
  fields: {
    duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long the image stays on screen' },
  },
  state: { url: '', at: 0 },
  main: 'show', // what a widget node runs; other actions go through Widget Callback nodes
  inputs: { show: { type: 'image', hint: 'Upload, pick from Giphy, or paste a URL, e.g. {{image}} from a previous node' } },
  playTime: (action, config) => config.duration * 1000 + 600, // in, shown, out; the workflow waits for it
  actions: {
    // A value that isn't an image URL (e.g. text left in a widget node) shows nothing.
    show: (state, { value }) => ({ url: /^(https?:\/\/|\/media\/)/.test(value) ? value : '', at: Date.now() }),
  },
}
