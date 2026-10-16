// Spin wheel: "spin" picks an option at random, weighted: a bigger weight is a bigger section, so a likelier winner.
// Each option has a label, a color and a weight; the page animates the wheel onto the winner. Outputs { winner }.
export default {
  type: 'wheel',
  label: 'Spin Wheel',
  description: 'Spins a wheel of weighted, colored options and picks a winner.',
  config: {
    options: [
      { label: 'Purple', color: '#9147ff', weight: 1 },
      { label: 'Pink', color: '#ff4f8b', weight: 1 },
      { label: 'Teal', color: '#00c2a8', weight: 1 },
      { label: 'Gold', color: '#ffb400', weight: 1 },
    ],
    duration: 5,
    pointerColor: '#ffffff', // the pointer above the wheel
  },
  state: { winner: -1, at: 0 },
  adds: ['winner'],
  output: (state, config) => ({ winner: config.options[state.winner]?.label ?? '' }),
  inputs: {}, // no action takes a value
  playTime: (action, config) => config.duration * 1000, // ms a spin lasts; the workflow waits for it
  actions: {
    spin(state, input, config) {
      const weights = config.options.map((o) => Math.max(0, Number(o.weight) || 0))
      let r = Math.random() * weights.reduce((a, b) => a + b, 0)
      return { winner: weights.findIndex((w) => (r -= w) < 0), at: Date.now() }
    },
  },
}
