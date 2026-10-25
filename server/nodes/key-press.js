// Action: presses a key combo on this machine via nut.js, e.g. "LeftControl+F1" (names from nut.js Key enum), or keys
// from data ("{{keys}}" after a TwitchPlays widget). With a window set, presses only while that window is focused.
// Keys are held a while: games that read input once a frame miss shorter taps. macOS: the terminal running Ovrly needs
// the Accessibility permission.
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { fill } from '../template.js'
import { focused } from '../windows.js'

keyboard.config.autoDelayMs = 0 // nut.js waits 300 ms before each press and release; holding is timed here

export default {
  type: 'key-press',
  label: 'Key Press',
  category: 'action',
  group: 'System',
  description: 'Presses a key combo on this machine, optionally only while a given window is focused.',
  fields: {
    keys: {
      type: 'tags',
      options: Object.keys(Key).filter((k) => isNaN(k)), // the enum also maps numbers back to names
      hint: 'Pressed together, e.g. LeftControl + F1, or {{keys}} from data',
      info: process.platform === 'darwin' ? 'macOS needs the Accessibility permission (System Settings → Privacy & Security).' : undefined,
    },
    window: { type: 'window', label: 'Only when focused', hint: 'An app or window (or part of its name); empty: any' },
    hold: { label: 'Hold for', unit: 'ms', presets: [50, 100, 250, 500, 1000], hint: 'Longer for a move in a game' },
  },
  config: { keys: 'Space', window: '', hold: 50 },
  async run({ config, data }) {
    const keys = fill(config.keys, data).split('+').filter((k) => k.trim()).map((name) => {
      const key = Key[name.trim()]
      if (typeof key !== 'number') throw new Error(`Unknown key: ${name}`)
      return key
    })
    if (!keys.length) return null // e.g. {{keys}} with nothing in data
    if (config.window && !(await focused()).toLowerCase().includes(config.window.toLowerCase())) return null // not focused: skip
    await keyboard.pressKey(...keys)
    await new Promise((resolve) => setTimeout(resolve, config.hold))
    await keyboard.releaseKey(...keys)
    return data
  },
}
