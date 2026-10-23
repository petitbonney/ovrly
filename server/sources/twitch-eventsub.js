// Twitch EventSub over WebSocket (Streamer mode): subscribes to the streamer's channel events and publishes each one on
// the bus under its EventSub type, e.g. `channel.follow` with the event as data. Reconnects every 5s when
// dropped, and follows Twitch's reconnect messages. Connecting and errors are recorded as `twitch-eventsub` events.
import bus, { record } from '../bus.js'
import { helix, status as account } from './twitch-auth.js'

// EventSub type -> version: what the Voting widget and the Twitch triggers follow.
const TYPES = {
  'channel.poll.progress': '1', 'channel.poll.end': '1',
  'channel.prediction.progress': '1', 'channel.prediction.lock': '1', 'channel.prediction.end': '1',
  'channel.follow': '2', 'channel.subscribe': '1', 'channel.subscription.message': '1', 'channel.subscription.gift': '1',
  'channel.cheer': '1', 'channel.channel_points_custom_reward_redemption.add': '1', 'channel.raid': '1',
  'stream.online': '1', 'stream.offline': '1',
  'channel.hype_train.begin': '2', 'channel.hype_train.progress': '2', 'channel.hype_train.end': '2',
}
// Most types are about the broadcaster's channel; these few name it differently.
const condition = (type, id) => ({
  'channel.follow': { broadcaster_user_id: id, moderator_user_id: id },
  'channel.raid': { to_broadcaster_user_id: id },
})[type] ?? { broadcaster_user_id: id }

// live: whether the stream is on (read when connecting, then from stream.online and stream.offline).
export const status = { connected: false, live: false, error: '' }
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
  Object.assign(status, { connected: false, live: false, error: '' })
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
      helix('GET', 'streams', undefined, { user_id: account.userId }).then((streams) => { status.live = streams.length > 0 }, () => {})
      for (const [type, version] of Object.entries(TYPES)) {
        helix('POST', 'eventsub/subscriptions', { type, version, condition: condition(type, account.userId),
          transport: { method: 'websocket', session_id: payload.session.id } })
          .catch((err) => { status.error = err.message })
      }
      // Outgoing raids too, published as `twitch.raid.out` (the Raid action waits for its raid).
      helix('POST', 'eventsub/subscriptions', { type: 'channel.raid', version: '1', condition: { from_broadcaster_user_id: account.userId },
        transport: { method: 'websocket', session_id: payload.session.id } })
        .catch((err) => { status.error = err.message })
    }
    if (metadata.message_type === 'session_reconnect') open(gen, payload.session.reconnect_url, true)
    if (metadata.message_type === 'notification') {
      const out = metadata.subscription_type === 'channel.raid' && payload.event.from_broadcaster_user_id === account.userId
      if (metadata.subscription_type.startsWith('stream.')) status.live = metadata.subscription_type === 'stream.online'
      bus.emit(out ? 'twitch.raid.out' : metadata.subscription_type, payload.event)
    }
    if (metadata.message_type === 'revocation') record('websocket', 'twitch-eventsub', { revoked: payload.subscription.type, reason: payload.subscription.status })
  }
}
