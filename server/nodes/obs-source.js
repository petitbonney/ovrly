// Action: shows, hides or toggles a source in an OBS scene via obs-websocket v5.
import { request } from '../obs.js'
import { fill } from '../template.js'

export default {
  type: 'obs-source',
  label: 'OBS toggle source',
  category: 'action',
  description: 'Shows, hides or toggles a source in an OBS scene.',
  fields: {
    url: { label: 'OBS WebSocket URL' },
    password: { type: 'secret' },
    scene: { vars: true },
    source: { vars: true },
    visible: { options: ['toggle', 'show', 'hide'] },
  },
  config: { url: 'ws://localhost:4455', password: '', scene: 'Scene', source: '', visible: 'toggle' },
  async run({ config, data }) {
    const { url, password } = config
    const sceneName = fill(config.scene, data)
    const { sceneItemId } = await request(url, password, 'GetSceneItemId', { sceneName, sourceName: fill(config.source, data) })
    let enabled = config.visible === 'show'
    if (config.visible === 'toggle') {
      enabled = !(await request(url, password, 'GetSceneItemEnabled', { sceneName, sceneItemId })).sceneItemEnabled
    }
    await request(url, password, 'SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: enabled })
    return data
  },
}
