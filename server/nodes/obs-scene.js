// Action: switches the OBS program scene, through the OBS integration (sidebar); optionally back to the one before
// after a while (unless someone switched again meanwhile), the next nodes running once back.
import { request } from '../integrations/obs.js'
import { fill } from '../template.js'

const current = async () => (await request('GetCurrentProgramScene')).currentProgramSceneName

export default {
  type: 'obs-scene',
  label: 'Switch Scene',
  icon: 'movie',
  category: 'action',
  group: 'OBS',
  play: true,
  needs: ['obs'],
  description: 'Switches the OBS program scene, and back after a while if set.',
  fields: {
    scene: { vars: true, obs: 'scenes' },
    back: { label: 'Switch back after', unit: 's', presets: [0, 5, 10, 30, 60], off: true, hint: 'The next nodes run once back' },
  },
  config: { scene: '', back: 0 },
  async run({ config, data, signal }) {
    const sceneName = fill(config.scene, data)
    const before = config.back > 0 && (await current())
    await request('SetCurrentProgramScene', { sceneName })
    if (!before || before === sceneName) return data
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, config.back * 1000)
      signal.addEventListener('abort', () => resolve(clearTimeout(timer)), { once: true }) // cancelled: back right away
    })
    if ((await current()) === sceneName) await request('SetCurrentProgramScene', { sceneName: before })
    return data
  },
}
