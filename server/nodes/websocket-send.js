// Action: opens a WebSocket, sends one message ({key} placeholders filled from data), then closes.
import { fill } from '../template.js'

export default {
  type: 'websocket-send',
  label: 'WebSocket send',
  category: 'action',
  config: { url: 'ws://localhost:8080', message: '{message}' },
  async run({ config, data }) {
    const ws = new WebSocket(fill(config.url, data))
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error(`WebSocket: cannot connect to ${ws.url}`))
    })
    ws.send(fill(config.message, data))
    ws.close()
    return data
  },
}
