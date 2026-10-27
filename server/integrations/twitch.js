// Twitch connection, in one of two modes. Guest: reads any channel's chat, no sign-in. Streamer: signed in as the
// channel owner (twitch-auth.js), reads its chat and follows its EventSub events (twitch-eventsub.js), which Twitch
// features like polls and predictions need. Chat comes from an anonymous tmi.js connection in both modes and is
// published as `chat` events on the bus; connecting and disconnecting are recorded as `twitch` events. Until EventSub
// is connected, the subs, cheers and raids chat announces are published as EventSub events, so the triggers that
// follow them also work in Guest mode. Either way, each gift is published again as `twitch.gift` once its subs are
// in, with who received them.
import { Router } from 'express'
import * as store from '../store.js'
import { httpError, unavailable } from '../errors.js'
import tmi from 'tmi.js'
import bus, { record } from '../bus.js'
import * as auth from './twitch-auth.js'
import * as eventsub from './twitch-eventsub.js'

let client = null
// Gifter -> subs of their community gifts still to be announced one by one, which aren't gifts of their own.
const pending = {}
// Chat messages sent by Send Chat Message: message id -> the triggers of the firing that sent it (`workflow/node` keys,
// see engine.js). Those triggers skip it when it comes back through chat, so a reply can't fire its own workflow
// again and loop; other triggers still fire on it. Kept a minute.
export const sentBy = new Map()
// mode and guestChannel are the settings; channel is the chat being read.
export const status = { mode: 'guest', guestChannel: '', channel: '', connected: false }

// Whether Streamer features can run: Streamer mode, signed in with every scope Ovrly asks for.
export const streamer = () => status.mode === 'streamer' && !!auth.status.login && auth.status.scopesOk
// For nodes and widgets: throws unless Streamer features can run. what: the feature, e.g. 'Twitch polls'.
export function needStreamer(what) {
  if (!streamer()) throw httpError(503, `${what} need Twitch in Streamer mode, signed in (Settings → Twitch)`)
}

// Applies the settings ({ mode, channel }), or the current ones again after signing in or out. Streamer mode reads the
// signed-in channel's chat; until signed in, it keeps reading the Guest channel's, so chat triggers keep working.
export async function apply(settings = { mode: status.mode, channel: status.guestChannel }) {
  Object.assign(status, { mode: settings.mode === 'streamer' ? 'streamer' : 'guest', guestChannel: settings.channel ?? '' })
  await connect(status.mode === 'streamer' && auth.status.login ? auth.status.login : status.guestChannel)
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
    const badges = tags.badges ?? {}
    const emotes = Object.values(tags.emotes ?? {}).flat().map((range) => { const [from, to] = range.split('-'); return message.slice(from, Number(to) + 1) })
    bus.emit('chat', {
      user: tags['display-name'] || tags.username, message, channel: chan.slice(1), messageId: tags.id,
      login: tags.username, userId: tags['user-id'], color: tags.color, timestamp: Number(tags['tmi-sent-ts']),
      broadcaster: 'broadcaster' in badges, mod: !!tags.mod, vip: 'vip' in badges, sub: !!tags.subscriber,
      subMonths: Number(tags['badge-info']?.subscriber) || 0,
      firstMessage: tags['first-msg'] === '1', returning: tags['returning-chatter'] === '1',
      emotes, action: tags['message-type'] === 'action', highlighted: tags['msg-id'] === 'highlighted-message', rewardId: tags['custom-reward-id'] ?? '',
      replyToId: tags['reply-parent-msg-id'] ?? '', replyToUser: tags['reply-parent-display-name'] ?? '', replyToMessage: tags['reply-parent-msg-body'] ?? '',
    })
  })
  // Chat's sub announcements as EventSub events (only while EventSub, which sends the real ones, isn't connected).
  const emit = (type, event) => eventsub.status.connected || bus.emit(type, event)
  const name = (tags) => tags['display-name'] || tags.login || tags.username
  const tier = (methods) => (methods?.plan === 'Prime' ? '1000' : methods?.plan)
  const gift = (tags, total) => {
    const anonymous = tags.login === 'ananonymousgifter'
    emit('channel.subscription.gift', { user_name: anonymous ? null : name(tags), user_login: anonymous ? null : tags.login, is_anonymous: anonymous, total,
      tier: tags['msg-param-sub-plan'], cumulative_total: Number(tags['msg-param-sender-count']) || null })
  }
  client.on('subscription', (chan, user, methods, message, tags) => {
    emit('channel.subscribe', { user_name: name(tags), tier: tier(methods), is_gift: false })
  })
  client.on('resub', (chan, user, months, message, tags, methods) => {
    emit('channel.subscription.message', { user_name: name(tags), tier: tier(methods), message: { text: message ?? '' },
      cumulative_months: Number(tags['msg-param-cumulative-months']) || 1,
      streak_months: tags['msg-param-should-share-streak'] ? Number(tags['msg-param-streak-months']) : null })
  })
  const gifted = (tags, recipient, methods) => {
    // gifter_login isn't in EventSub: chat says who gifted it, which helps match it to its gift.
    emit('channel.subscribe', { user_name: tags['msg-param-recipient-display-name'] || recipient, tier: tier(methods), is_gift: true,
      gifter_login: tags.login === 'ananonymousgifter' ? null : tags.login })
    if (pending[tags.login] > 0) pending[tags.login]--
    else gift(tags, 1)
  }
  const community = (tags, count) => {
    pending[tags.login] = (pending[tags.login] ?? 0) + count
    gift(tags, count)
  }
  client.on('subgift', (chan, user, streak, recipient, methods, tags) => gifted(tags, recipient, methods))
  client.on('anonsubgift', (chan, streak, recipient, methods, tags) => gifted(tags, recipient, methods))
  client.on('submysterygift', (chan, user, count, methods, tags) => community(tags, Number(count)))
  client.on('anonsubmysterygift', (chan, count, methods, tags) => community(tags, Number(count)))
  client.on('cheer', (chan, tags, message) => {
    const anonymous = !tags.username || tags.username === 'ananonymouscheerer'
    emit('channel.cheer', { user_name: anonymous ? null : name(tags), is_anonymous: anonymous, bits: Number(tags.bits), message })
  })
  client.on('raided', (chan, user, viewers) => {
    emit('channel.raid', { from_broadcaster_user_name: user, viewers: Number(viewers) })
  })
  client.connect().catch((err) => console.error('[twitch]', err))
}

// A gift's subs arrive as separate gifted subs that don't say which gift they're from (EventSub), just before or after
// it. Each gift waits for as many gifted subs of its tier (and gifter, when chat says), 5s at most, then is published
// as `twitch.gift` with recipients: their names. Two gifts of the same tier at once may swap a few recipients.
const gifts = [] // gifts waiting for their subs: { event, recipients, timer }
let loose = [] // gifted subs no gift has claimed yet: { event, at }
const fits = (gift, sub) => sub.tier === gift.event.tier && (!sub.gifter_login || sub.gifter_login === gift.event.user_login)
function done(gift) {
  clearTimeout(gift.timer)
  gifts.splice(gifts.indexOf(gift), 1)
  bus.emit('twitch.gift', { ...gift.event, recipients: gift.recipients })
}
bus.on('channel.subscription.gift', (event) => {
  const gift = { event, recipients: [] }
  loose = loose.filter((l) => Date.now() - l.at < 5000)
  for (const l of [...loose]) {
    if (gift.recipients.length >= event.total || !fits(gift, l.event)) continue
    gift.recipients.push(l.event.user_name)
    loose.splice(loose.indexOf(l), 1)
  }
  gifts.push(gift)
  if (gift.recipients.length >= event.total) return done(gift)
  gift.timer = setTimeout(() => done(gift), 5000)
})
bus.on('channel.subscribe', (event) => {
  if (!event.is_gift) return
  const gift = gifts.find((g) => fits(g, event))
  if (!gift) return loose.push({ event, at: Date.now() })
  gift.recipients.push(event.user_name)
  if (gift.recipients.length >= gift.event.total) done(gift)
})

// Routes (Settings → Twitch): the mode (guest or streamer) and guest channel settings, saving them reconnects; and the
// streamer sign-in.
export const routes = Router()
const fullStatus = () => ({ ...status, streamer: streamer(), account: auth.status, eventsub: eventsub.status })
routes.get('/api/twitch', (req, res) => res.json(fullStatus()))
routes.put('/api/twitch', async (req, res) => {
  const settings = { mode: req.body.mode === 'streamer' ? 'streamer' : 'guest', channel: String(req.body.channel || '').trim().toLowerCase().replace(/^#/, '') }
  await store.save('settings', { id: 'twitch', ...settings })
  await apply(settings)
  res.json(fullStatus())
})
// The channel's reward titles, for the Channel Points trigger's picker.
routes.get('/api/twitch/rewards', async (req, res) => {
  needStreamer('Channel points rewards')
  const rewards = await auth.helix('GET', 'channel_points/custom_rewards', undefined, { broadcaster_id: auth.status.userId }).catch(unavailable)
  res.json(rewards.map((r) => r.title).sort())
})
// Starts a sign-in (the dialog then shows the code to approve), cancels a pending one, or signs out.
routes.post('/api/twitch/login', (req, res) =>
  auth.start(() => apply()).then(() => res.json(fullStatus()), (err) => res.status(502).json({ error: err.message })))
routes.post('/api/twitch/login/cancel', (req, res) => {
  auth.cancel()
  res.json(fullStatus())
})
routes.delete('/api/twitch/login', async (req, res) => {
  await auth.logout()
  await apply()
  res.json(fullStatus())
})
