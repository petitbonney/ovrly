// Action: opens a WebSocket, sends one message ({{key}} placeholders filled from data), then closes. The message (or the
// connection failure) is recorded as a `websocket` event.
import { fill } from '../template.js'
import { record } from '../bus.js'

export default {
  type: 'websocket-send',
  label: 'WebSocket Send',
  category: 'action',
  group: 'System',
  description: 'Opens a WebSocket, sends one message, then closes.',
  fields: { url: { label: 'URL' }, message: { vars: true, multiline: true } },
  config: { url: 'ws://localhost:8080', message: '{{message}}' },
  async run({ config, data }) {
    const url = fill(config.url, data)
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => {
        record('websocket', 'websocket-send', { url, error: 'cannot connect' })
        reject(new Error(`WebSocket: cannot connect to ${url}`))
      }
    })
    ws.onerror = null // connected: a later failure (e.g. the server going away while closing) isn't a connect error
    const message = fill(config.message, data)
    ws.send(message)
    record('websocket', 'websocket-send', { url, message })
    ws.close()
    return data
  },
}
