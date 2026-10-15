// Action: switches the OBS program scene via obs-websocket v5.
import { request } from '../obs.js'
import { fill } from '../template.js'

export default {
  type: 'obs-scene',
  label: 'OBS switch scene',
  category: 'action',
  description: 'Switches the OBS program scene.',
  fields: { url: { label: 'OBS WebSocket URL' }, password: { type: 'secret' }, scene: { vars: true } },
  config: { url: 'ws://localhost:4455', password: '', scene: 'Scene' },
  async run({ config, data }) {
    await request(config.url, config.password, 'SetCurrentProgramScene', { sceneName: fill(config.scene, data) })
    return data
  },
}
