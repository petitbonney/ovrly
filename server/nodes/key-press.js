// Action: presses a key combo on this machine via nut.js, e.g. "LeftControl+F1" (names from nut.js Key enum).
// macOS: the terminal running Ovrly needs the Accessibility permission.
import { keyboard, Key } from '@nut-tree-fork/nut-js'

export default {
  type: 'key-press',
  label: 'Key press',
  category: 'action',
  description: 'Presses a key combo on this machine.',
  fields: {
    keys: {
      type: 'keys',
      options: Object.keys(Key).filter((k) => isNaN(k)), // the enum also maps numbers back to names
      hint: 'Pressed together, e.g. LeftControl + F1. macOS needs the Accessibility permission.',
    },
  },
  config: { keys: 'Space' },
  async run({ config, data }) {
    const keys = config.keys.split('+').map((name) => {
      const key = Key[name.trim()]
      if (typeof key !== 'number') throw new Error(`Unknown key: ${name}`)
      return key
    })
    await keyboard.pressKey(...keys)
    await keyboard.releaseKey(...keys)
    return data
  },
}
