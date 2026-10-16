// Twitch connection, in one of two modes. Guest: reads any channel's chat, no sign-in. Streamer: signed in as the
// channel owner (twitch-auth.js), reads its chat and follows its EventSub events (twitch-eventsub.js), which Twitch
// features like polls and predictions need. Chat comes from an anonymous tmi.js connection in both modes and is
// published as `chat` events on the bus; connecting and disconnecting are recorded as `twitch` events.
import tmi from 'tmi.js'
import bus, { record } from '../bus.js'
import * as auth from './twitch-auth.js'
import * as eventsub from './twitch-eventsub.js'

let client = null
// mode and guestChannel are the settings; channel is the chat being read.
export const status = { mode: 'guest', guestChannel: '', channel: '', connected: false }

// Whether Streamer features can run: Streamer mode, signed in with every scope Ovrly asks for.
export const streamer = () => status.mode === 'streamer' && !!auth.status.login && auth.status.scopesOk
// For nodes and widgets: throws unless Streamer features can run. what: the feature, e.g. 'Twitch polls'.
export function needStreamer(what) {
  if (!streamer()) throw new Error(`${what} need Twitch in Streamer mode, signed in (Integration → Twitch)`)
}

// Applies the settings ({ mode, channel }), or the current ones again after signing in or out.
export async function apply(settings = { mode: status.mode, channel: status.guestChannel }) {
  Object.assign(status, { mode: settings.mode === 'streamer' ? 'streamer' : 'guest', guestChannel: settings.channel ?? '' })
  await connect(status.mode === 'streamer' ? auth.status.login : status.guestChannel)
  status.mode === 'streamer' && auth.status.login ? eventsub.connect() : eventsub.disconnect()
}

// (Re)connects the chat to a single channel; an empty name just disconnects.
async function connect(channel) {
  if (client) await client.disconnect().catch(() => {})
  Object.assign(status, { channel, connected: false })
  client = null
  if (!channel) return

  client = new tmi.Client({ channels: [channel], connection: { reconnect: true, secure: true } })
  client.on('connected', () => {
    status.connected = true
    record('websocket', 'twitch', { channel, connected: true })
  })
  client.on('disconnected', (reason) => {
    status.connected = false
    record('websocket', 'twitch', { channel, connected: false, reason })
  })
  client.on('message', (chan, tags, message) => {
    bus.emit('chat', { user: tags['display-name'] || tags.username, message, channel: chan.slice(1) })
  })
  client.connect().catch((err) => console.error('[twitch]', err))
}
