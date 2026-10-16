// Action: switches the OBS program scene, through the OBS integration (sidebar).
import { request } from '../obs.js'
import { fill } from '../template.js'

export default {
  type: 'obs-scene',
  label: 'OBS - Switch Scene',
  category: 'action',
  description: 'Switches the OBS program scene.',
  fields: { scene: { vars: true, obs: 'scenes' } },
  config: { scene: '' },
  async run({ config, data }) {
    await request('SetCurrentProgramScene', { sceneName: fill(config.scene, data) })
    return data
  },
}
