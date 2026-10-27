// Action: gets info on a channel (yours, or one named in Channel), as one of: its stream { live, title, game, tags,
// viewers, uptime (minutes), startedAt, thumbnail }, its counts { followers, lastFollower, lastFollowedAt, subs,
// subPoints } (last follower for yours or one you moderate, subs only for yours), its last clip { clipId, clipUrl,
// clipTitle, clipViews, clipBy }, its next scheduled stream { nextTitle, nextGame, nextStart, nextIn (minutes) }, or the
// whole response of any Helix call { response }. Always adds channelId.
import { helix, helixJson, status, user } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'
import { fill, fillJson, fillUrl } from '../template.js'

const minutes = (ms) => Math.round(ms / 60_000)

const get = {
  async stream(id) {
    const [[stream], [ch]] = await Promise.all([helix('GET', 'streams', undefined, { user_id: id }), helix('GET', 'channels', undefined, { broadcaster_id: id })])
    return { live: !!stream, title: ch?.title ?? '', game: ch?.game_name ?? '', tags: ch?.tags ?? [], viewers: stream?.viewer_count ?? 0,
      uptime: stream ? minutes(Date.now() - Date.parse(stream.started_at)) : 0, startedAt: stream?.started_at ?? '',
      thumbnail: stream?.thumbnail_url.replace('{width}x{height}', '1280x720') ?? '' }
  },
  async counts(id) {
    const mine = id === status.userId
    const [follows, subs] = await Promise.all([
      helixJson('GET', 'channels/followers', undefined, { broadcaster_id: id, first: 1 }),
      mine && helixJson('GET', 'subscriptions', undefined, { broadcaster_id: id, first: 1 }),
    ])
    // Twitch lists the newest follower first, but only to the channel's broadcaster and its moderators.
    const [last] = follows.data ?? []
    return { followers: follows.total ?? 0, lastFollower: last?.user_name ?? '', lastFollowedAt: last?.followed_at ?? '',
      subs: mine ? subs.total ?? 0 : '', subPoints: mine ? subs.points ?? 0 : '' }
  },
  // Twitch lists clips by views, not date: look in a growing window back from now, so a busy channel still gets its last one.
  async clip(id) {
    for (const days of [1, 7, 30, 365]) {
      const query = { broadcaster_id: id, first: 100, started_at: new Date(Date.now() - days * 86_400_000).toISOString(), ended_at: new Date().toISOString() }
      const [clip] = (await helix('GET', 'clips', undefined, query)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      if (clip) return { clipId: clip.id, clipUrl: clip.url, clipTitle: clip.title, clipViews: clip.view_count, clipBy: clip.creator_name }
    }
    return { clipId: '', clipUrl: '', clipTitle: '', clipViews: 0, clipBy: '' }
  },
  async schedule(id) {
    // Twitch answers 404 when the channel has no schedule.
    const schedule = await helix('GET', 'schedule', undefined, { broadcaster_id: id, first: 5 }).catch((err) => {
      if (/not found/i.test(err.message)) return null
      throw err
    })
    const next = schedule?.segments?.find((s) => !s.canceled_until)
    return { nextTitle: next?.title ?? '', nextGame: next?.category?.name ?? '', nextStart: next?.start_time ?? '',
      nextIn: next ? Math.max(0, minutes(Date.parse(next.start_time) - Date.now())) : '' }
  },
}

export default {
  type: 'twitch-channel-info',
  label: 'Channel Info',
  icon: 'device-tv-old',
  category: 'action',
  group: 'Twitch',
  play: true,
  needs: ['twitch'],
  description: 'Gets info on a channel: its stream, follower and sub counts, last clip or next scheduled stream, or calls the Twitch API.',
  adds: ['channelId', 'live', 'title', 'game', 'tags', 'viewers', 'uptime', 'startedAt', 'thumbnail', 'followers',
    'lastFollower', 'lastFollowedAt', 'subs', 'subPoints', 'clipId', 'clipUrl', 'clipTitle', 'clipViews', 'clipBy', 'nextTitle', 'nextGame', 'nextStart', 'nextIn', 'response'],
  fields: {
    what: {
      options: [
        { value: 'stream', label: 'Stream' },
        { value: 'counts', label: 'Followers and subs' },
        { value: 'clip', label: 'Last clip' },
        { value: 'schedule', label: 'Next stream' },
        { value: 'custom', label: 'Custom API call' },
      ],
      info: 'Stream: live, title, game, tags, viewers, uptime (min), startedAt, thumbnail. Followers and subs: followers, lastFollower, lastFollowedAt (only for your channel or one you moderate), subs, subPoints (only for your channel). Last clip: clipUrl, clipTitle, clipViews, clipBy. Next stream: nextTitle, nextGame, nextStart, nextIn (min). Custom API call: response, the whole answer.',
    },
    channel: { vars: true, hint: 'A login, e.g. {{user}}; empty: yours', info: '{{ $vars.channel }} is yours, set when you sign in to Twitch.' },
    method: { options: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], only: { what: 'custom' } },
    path: { vars: true, only: { what: 'custom' }, hint: 'e.g. polls?broadcaster_id={{channelId}}',
      info: 'Any endpoint of the Twitch Helix API (dev.twitch.tv/docs/api/reference), after /helix/. {{channelId}} is the channel above. Endpoints that need a permission Ovrly does not ask for fail.' },
    body: { vars: true, multiline: true, only: { what: 'custom', method: ['POST', 'PATCH', 'PUT'] }, hint: 'JSON' },
  },
  config: { what: 'stream', channel: '{{ $vars.channel }}', method: 'GET', path: 'polls?broadcaster_id={{channelId}}', body: '{}' },
  async run({ config, data }) {
    needStreamer('Channel info')
    const name = fill(config.channel, data).trim().replace(/^@/, '').toLowerCase()
    const channelId = name && name !== status.login ? (await user(name)).id : status.userId
    if (config.what !== 'custom') return { ...data, channelId, ...(await get[config.what](channelId)) }
    const path = fillUrl(config.path, { ...data, channelId }).trim().replace(/^(https:\/\/api\.twitch\.tv)?\/?(helix\/)?/, '')
    let body
    if (['POST', 'PATCH', 'PUT'].includes(config.method)) {
      try { body = JSON.parse(fillJson(config.body || '{}', data)) } catch { throw new Error('Channel info: the body is not valid JSON') }
    }
    return { ...data, channelId, response: await helixJson(config.method, path, body, {}) }
  },
}
