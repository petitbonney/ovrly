// Action: presses a key combo on this machine via nut.js, e.g. "LeftControl+F1" (names from nut.js Key enum).
// macOS: the terminal running Ovrly needs the Accessibility permission.
import { keyboard, Key } from '@nut-tree-fork/nut-js'

export default {
  type: 'key-press',
  label: 'Key press',
  category: 'action',
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
