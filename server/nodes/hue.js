// Action: Philips Hue lights, through the Hue integration (sidebar). Toggle, Set and Off are one command. Routine plays
// a list of steps and runs until it ends: Stop (settings pane) ends it with a fade and the workflow goes on, Cancel (or
// the workflow's cancel) ends it at once and the workflow stops there; both put the lights back as they were. Firing it
// again on the same device replaces what plays there.
import * as hue from '../hue.js'

export default {
  type: 'hue',
  label: 'Hue Lights',
  icon: 'bulb',
  category: 'action',
  group: 'Home',
  play: true,
  needs: ['hue'],
  description: 'Toggles, sets or turns off Philips Hue lights, or plays a routine of colors on them.',
  fields: {
    mode: { options: ['toggle', 'set', 'routine', 'off'] },
    device: { label: 'Light, room or zone', hue: 'devices' },
    brightness: { slider: true, unit: '%', only: { mode: 'set' } },
    color: { only: { mode: 'set' } },
    transition: { unit: 'ms', presets: [0, 400, 1000], hint: 'How long each change fades' },
    steps: {
      type: 'hue-steps', section: 'Routine', limits: hue.limits, only: { mode: 'routine' },
      columns: { action: { options: ['set', 'off'] }, color: { only: { action: 'set' } }, brightness: { label: 'Brightness', unit: '%', max: 100, only: { action: 'set' } }, duration: { label: 'Duration', unit: 'ms' } },
    },
    loop: { label: 'Repeat', options: [{ value: 'once', label: 'Once' }, { value: 'times', label: 'N times' }, { value: 'forever', label: 'Until stopped' }], only: { mode: 'routine' } },
    times: { only: { mode: 'routine', loop: 'times' } },
    restore: { label: 'Restore the lights at the end', hint: 'Stop and Cancel always restore them', only: { mode: 'routine' } },
  },
  // steps: a blink in red, by default.
  config: {
    mode: 'toggle', device: '', brightness: 100, color: '#ffffff', transition: 400,
    steps: [{ action: 'set', color: '#e03131', brightness: 100, duration: 500 }, { action: 'set', color: '#e03131', brightness: 10, duration: 500 }],
    loop: 'times', times: 3, restore: true,
  },
  async run({ config, data, id, signal }) {
    const target = config.device
    if (!target) throw new Error('Hue Lights: pick a light, room or zone')
    const dynamics = { duration: Math.max(0, config.transition) }
    if (config.mode === 'toggle') {
      const [{ on }] = await hue.request('GET', target)
      await hue.send(target, { on: { on: !on.on }, dynamics })
    }
    if (config.mode === 'off') await hue.send(target, { on: { on: false }, dynamics })
    if (config.mode === 'set') {
      await hue.send(target, { on: { on: true }, dimming: { brightness: config.brightness }, color: { xy: hue.xy(config.color) }, dynamics })
    }
    if (config.mode !== 'routine') return data
    // Guardrails: each step lasts at least the device's minimum, fading over at most its duration.
    const min = target.startsWith('grouped_light/') ? hue.limits.group : hue.limits.light
    const steps = config.steps.slice(0, hue.limits.steps).map((s) => {
      const duration = Math.max(min, Number(s.duration) || 0)
      const brightness = Math.min(100, Math.max(0, Number(s.brightness) || 0))
      return { off: s.action === 'off', color: s.color, brightness, duration, transition: Math.min(dynamics.duration, duration) }
    })
    if (!steps.length) return data
    const rounds = { once: 1, times: Math.max(1, Number(config.times) || 1), forever: Infinity }[config.loop]
    const how = await hue.play(target, { steps, rounds, transition: dynamics.duration, restore: config.restore }, id, signal)
    return how === 'end' || how === 'stop' ? data : null
  },
}
