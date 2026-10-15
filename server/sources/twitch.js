// Twitch chat source: anonymous tmi.js connection that publishes `chat` events on the bus.
import tmi from 'tmi.js'
import bus from '../bus.js'

let client = null
export const status = { channel: '', connected: false }

// (Re)connects to a single channel; an empty name just disconnects.
export async function connect(channel) {
  if (client) await client.disconnect().catch(() => {})
  Object.assign(status, { channel, connected: false })
  client = null
  if (!channel) return

  client = new tmi.Client({ channels: [channel], connection: { reconnect: true, secure: true } })
  client.on('connected', () => (status.connected = true))
  client.on('disconnected', () => (status.connected = false))
  client.on('message', (chan, tags, message) => {
    bus.emit('chat', { user: tags['display-name'] || tags.username, message, channel: chan.slice(1) })
  })
  client.connect().catch((err) => console.error('[twitch]', err))
}
