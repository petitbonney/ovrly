// Spin wheel: "spin" picks a random option; the page animates the wheel onto it.
import { list } from '../lib.js'

export default {
  type: 'wheel',
  label: 'Spin wheel',
  config: { options: 'Red, Blue, Green, Yellow', duration: 5 },
  state: { winner: -1, at: 0 },
  actions: {
    spin: (state, input, config) => ({ winner: Math.floor(Math.random() * list(config.options).length), at: Date.now() }),
  },
}
