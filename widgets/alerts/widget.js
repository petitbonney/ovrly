// Alerts: shows a text banner for a few seconds, e.g. "bob just ran !hype".
export default {
  type: 'alerts',
  label: 'Alerts',
  description: 'Shows a text banner for a few seconds, e.g. who just ran a command.',
  config: { duration: 5 },
  fields: { duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long the banner stays on screen' } },
  state: { text: '', at: 0 },
  inputs: { show: 'Text to show, e.g. {{user}} just ran !hype' }, // actions that take a value, and what it is
  playTime: (action, config) => config.duration * 1000 + 400, // shown, then faded out; the workflow waits for it
  actions: {
    show: (state, { value }) => ({ text: value, at: Date.now() }),
  },
}
