// Spin wheel: "spin" picks a random option; the page animates the wheel onto it. Outputs { winner } (the option).
import { list } from '../lib.js'

export default {
  type: 'wheel',
  label: 'Spin wheel',
  config: { options: 'Red, Blue, Green, Yellow', duration: 5 },
  state: { winner: -1, at: 0 },
  adds: ['winner'],
  output: (state, config) => ({ winner: list(config.options)[state.winner] ?? '' }),
  inputs: {}, // no action takes a value
  playTime: (action, config) => config.duration * 1000, // ms a spin lasts; the workflow waits for it
  actions: {
    spin: (state, input, config) => ({ winner: Math.floor(Math.random() * list(config.options).length), at: Date.now() }),
  },
}
