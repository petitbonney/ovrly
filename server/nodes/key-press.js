// Action: presses a key combo on this machine via nut.js, e.g. "LeftControl+F1" (names from nut.js Key enum), or keys
// from data ("{{keys}}" after a TwitchPlays widget). With a window set, presses only while that window is focused.
// macOS: the terminal running Ovrly needs the Accessibility permission.
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { fill } from '../template.js'
import { focused } from '../windows.js'

export default {
  type: 'key-press',
  label: 'Key Press',
  category: 'action',
  group: 'System',
  description: 'Presses a key combo on this machine, optionally only while a given window is focused.',
  fields: {
    keys: {
      type: 'keys',
      options: Object.keys(Key).filter((k) => isNaN(k)), // the enum also maps numbers back to names
      hint: 'Pressed together, e.g. LeftControl + F1, or {{keys}} from data. macOS needs the Accessibility permission.',
    },
    window: { type: 'window', label: 'Only when focused', hint: 'An app or window, or part of its name, e.g. Dolphin; empty presses whatever is focused' },
  },
  config: { keys: 'Space', window: '' },
  async run({ config, data }) {
    const keys = fill(config.keys, data).split('+').filter((k) => k.trim()).map((name) => {
      const key = Key[name.trim()]
      if (typeof key !== 'number') throw new Error(`Unknown key: ${name}`)
      return key
    })
    if (!keys.length) return null // e.g. {{keys}} with nothing in data
    if (config.window && !(await focused()).toLowerCase().includes(config.window.toLowerCase())) return null // not focused: skip
    await keyboard.pressKey(...keys)
    await keyboard.releaseKey(...keys)
    return data
  },
}
