// Image/GIF: shows an uploaded image or a Giphy GIF for a few seconds, with an entry and exit effect.
export default {
  type: 'image',
  label: 'Image/GIF',
  description: 'Shows an image or animated GIF (uploaded or from Giphy) for a few seconds.',
  config: { image: '', duration: 5, effect: 'fade' },
  fields: {
    image: { type: 'image', hint: 'Shown when the action has no value' },
    duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long the image stays on screen' },
    effect: { options: ['fade', 'slide', 'rotate', 'scale'], hint: 'How it comes in and goes out' },
  },
  state: { url: '', at: 0 },
  main: 'show', // what a widget node runs; other actions go through Widget Callback nodes
  inputs: { show: 'Image URL, e.g. {{image}} from a previous node (empty: the widget\'s image)' },
  playTime: (action, config) => config.duration * 1000 + 600, // in, shown, out; the workflow waits for it
  actions: {
    // A value that isn't an image URL (e.g. text left in a widget node) is ignored.
    show: (state, { value }, config) => ({ url: /^(https?:\/\/|\/media\/)/.test(value) ? value : config.image, at: Date.now() }),
  },
}
