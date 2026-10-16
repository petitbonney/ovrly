// Twitch EventSub over WebSocket (Streamer mode): subscribes to the streamer's channel events and publishes each one on
// the bus under its EventSub type, e.g. `channel.poll.progress` with the event as data. Reconnects every 5s when
// dropped, and follows Twitch's reconnect messages. Connecting and errors are recorded as `twitch-eventsub` events.
import bus, { record } from '../bus.js'
import { helix, status as account } from './twitch-auth.js'

// What the Poll and Bets widgets follow. Add the types new triggers need here.
const TYPES = ['channel.poll.begin', 'channel.poll.progress', 'channel.poll.end',
  'channel.prediction.begin', 'channel.prediction.progress', 'channel.prediction.lock', 'channel.prediction.end']

export const status = { connected: false, error: '' }
let ws = null
let generation = 0 // bumped on each connect()/disconnect(), so an old socket's events are ignored
let retry, idle

export function connect() {
  disconnect()
  open(generation, 'wss://eventsub.wss.twitch.tv/ws')
}

export function disconnect() {
  generation++
  clearTimeout(retry)
  clearTimeout(idle)
  ws?.close()
  ws = null
  Object.assign(status, { connected: false, error: '' })
}

// reconnecting: Twitch asked us to move to a new URL; subscriptions carry over, so they aren't made again.
function open(gen, url, reconnecting) {
  const socket = new WebSocket(url)
  if (!reconnecting) ws = socket // a reconnect URL takes over only once welcomed
  socket.onerror = () => {} // the close event that follows says why
  socket.onclose = (e) => {
    if (gen !== generation || socket !== ws) return
    clearTimeout(idle)
    if (status.connected) record('websocket', 'twitch-eventsub', { connected: false })
    Object.assign(status, { connected: false, error: e.reason || status.error || 'cannot reach Twitch EventSub' })
    retry = setTimeout(() => open(gen, 'wss://eventsub.wss.twitch.tv/ws'), 5000)
  }
  socket.onmessage = async ({ data }) => {
    if (gen !== generation) return socket.close()
    const { metadata, payload } = JSON.parse(data)
    // No message (not even a keepalive) for longer than Twitch promised: the connection is dead.
    clearTimeout(idle)
    idle = setTimeout(() => socket.close(), ((payload.session?.keepalive_timeout_seconds ?? 10) + 5) * 1000)
    if (metadata.message_type === 'session_welcome') {
      if (ws !== socket) ws.close()
      ws = socket
      Object.assign(status, { connected: true, error: '' })
      record('websocket', 'twitch-eventsub', { connected: true })
      if (reconnecting) return
      for (const type of TYPES) {
        helix('POST', 'eventsub/subscriptions', { type, version: '1', condition: { broadcaster_user_id: account.userId },
          transport: { method: 'websocket', session_id: payload.session.id } })
          .catch((err) => { status.error = err.message })
      }
    }
    if (metadata.message_type === 'session_reconnect') open(gen, payload.session.reconnect_url, true)
    if (metadata.message_type === 'notification') bus.emit(metadata.subscription_type, payload.event)
    if (metadata.message_type === 'revocation') record('websocket', 'twitch-eventsub', { revoked: payload.subscription.type, reason: payload.subscription.status })
  }
}
