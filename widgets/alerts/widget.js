// Alerts: shows a text banner for a few seconds, e.g. "bob just ran !hype".
export default {
  type: 'alerts',
  label: 'Alerts',
  config: { duration: 5 },
  state: { text: '', at: 0 },
  actions: {
    show: (state, { value }) => ({ text: value, at: Date.now() }),
  },
}
