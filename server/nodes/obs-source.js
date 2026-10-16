// Action: shows, hides or toggles a source in an OBS scene, through the OBS integration (sidebar).
import { request } from '../obs.js'
import { fill } from '../template.js'

export default {
  type: 'obs-source',
  label: 'OBS - Toggle Source',
  category: 'action',
  description: 'Shows, hides or toggles a source in an OBS scene.',
  fields: {
    scene: { vars: true, obs: 'scenes' },
    source: { vars: true, obs: 'sources' }, // the sources of the scene above
    visible: { options: ['toggle', 'show', 'hide'] },
  },
  config: { scene: '', source: '', visible: 'toggle' },
  async run({ config, data }) {
    const sceneName = fill(config.scene, data)
    const { sceneItemId } = await request('GetSceneItemId', { sceneName, sourceName: fill(config.source, data) })
    let enabled = config.visible === 'show'
    if (config.visible === 'toggle') enabled = !(await request('GetSceneItemEnabled', { sceneName, sceneItemId })).sceneItemEnabled
    await request('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: enabled })
    return data
  },
}
