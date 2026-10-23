// Twitch sign-in for Streamer mode: OAuth Device Code flow as a public client (no secret, no redirect). The user opens
// twitch.tv/activate and approves the code shown in the Twitch dialog. Tokens live in data/settings/twitch-auth.json.
// Also the Helix API helper, which signs requests with that token.
import * as store from '../store.js'
import { record } from '../bus.js'

export const CLIENT_ID = '6vu8lgkxb5ljuijesmm2rlirke32ns'
// Polls and predictions (Voting widget), what the EventSub triggers need, then the Twitch action nodes.
const SCOPES = ['channel:manage:polls', 'channel:manage:predictions', 'channel:read:redemptions', 'moderator:read:followers',
  'channel:read:subscriptions', 'bits:read', 'channel:read:hype_train',
  'user:write:chat', 'moderator:manage:announcements', 'moderator:manage:shoutouts', 'moderator:manage:banned_users',
  'moderator:manage:chat_messages', 'moderator:manage:chat_settings', 'channel:manage:broadcast', 'channel:edit:commercial',
  'channel:manage:ads', 'clips:edit', 'channel:manage:redemptions', 'channel:manage:raids']

// login: the signed-in account; device: the code to approve while a sign-in is pending; scopesOk: false when the
// account was signed in before Ovrly asked for more scopes (sign in again).
export const status = { login: '', userId: '', scopesOk: false, device: null, error: '' }
let auth = null // { id, access, refresh, expiresAt, scopes, login, userId }
let polling = 0 // bumped on each start(), so an older sign-in stops polling

async function post(path, params) {
  const res = await fetch(`https://id.twitch.tv/oauth2/${path}`, { method: 'POST', body: new URLSearchParams({ client_id: CLIENT_ID, ...params }) })
  const body = await res.json().catch(() => ({}))
  return res.ok ? body : Promise.reject(Object.assign(new Error(body.message || `Twitch ${path}: ${res.status}`), { body }))
}

async function save(tokens) {
  auth = { ...auth, id: 'twitch-auth', access: tokens.access_token, refresh: tokens.refresh_token, scopes: tokens.scope,
    expiresAt: Date.now() + tokens.expires_in * 1000 }
  await store.save('settings', auth)
}

function show() {
  Object.assign(status, { login: auth?.login ?? '', userId: auth?.userId ?? '', scopesOk: SCOPES.every((s) => auth?.scopes?.includes(s)) })
}

export async function load() {
  auth = await store.get('settings', 'twitch-auth')
  show()
}

// Starts a sign-in: returns at once with the code to show, then polls in the background until the user approves,
// and calls onDone once signed in.
export async function start(onDone) {
  const gen = ++polling
  const d = await post('device', { scopes: SCOPES.join(' ') })
  Object.assign(status, { device: { code: d.user_code, uri: d.verification_uri, expiresAt: Date.now() + d.expires_in * 1000 }, error: '' })
  let interval = d.interval
  ;(async () => {
    while (gen === polling && Date.now() < status.device.expiresAt) {
      await new Promise((r) => setTimeout(r, interval * 1000))
      if (gen !== polling) return
      try {
        const tokens = await post('token', { scopes: SCOPES.join(' '), device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
        const user = await (await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${tokens.access_token}` } })).json()
        auth = { login: user.login, userId: user.user_id }
        await save(tokens)
        show()
        status.device = null
        record('http', 'twitch-auth', { login: user.login })
        return onDone()
      } catch (err) {
        if (err.body?.message === 'authorization_pending') continue
        if (err.body?.message === 'slow_down') interval += 5
        else return Object.assign(status, { device: null, error: err.message })
      }
    }
    if (gen === polling) Object.assign(status, { device: null, error: 'The code expired: sign in again' })
  })()
}

// A valid access token, refreshed when about to expire. Public clients' refresh tokens are single-use, so the new
// one is saved each time; one refresh at a time.
let refreshing = null
export async function token() {
  if (!auth?.access) throw new Error('Twitch: not signed in (Settings → Twitch → Streamer)')
  if (auth.expiresAt - Date.now() > 60_000) return auth.access
  refreshing ??= post('token', { grant_type: 'refresh_token', refresh_token: auth.refresh })
    .then(save, async (err) => {
      await logout() // the refresh token was revoked or expired (30 days unused)
      throw new Error(`Twitch: signed out (${err.message}), sign in again`)
    })
    .finally(() => { refreshing = null })
  await refreshing
  return auth.access
}

// One Helix API call as the signed-in streamer, e.g. helix('POST', 'polls', { title, … }); broadcaster_id is added to
// the body (but for EventSub, which takes a condition instead). With query (the endpoints that take their IDs in the
// URL), that query is sent instead, and the body as is. Returns the response's data array.
export async function helix(method, path, body, query) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}${query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''}`, {
    method,
    headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(query || path.startsWith('eventsub') ? body : { broadcaster_id: auth.userId, ...body }),
  })
  const json = await res.json().catch(() => ({}))
  record('http', 'twitch-api', { method, path, ...(!res.ok && { error: json.message }) })
  if (!res.ok) throw new Error(`Twitch ${path}: ${json.message || res.status}`)
  return json.data
}

// The query most moderation endpoints take: the streamer's channel, moderated by the streamer.
export const channel = () => ({ broadcaster_id: auth?.userId, moderator_id: auth?.userId })

// A Twitch user by login or display name ("@name" too): { id, login, display_name, profile_image_url, created_at, … }.
export async function user(name) {
  const login = String(name).trim().replace(/^@/, '').toLowerCase()
  const [found] = login ? await helix('GET', 'users', undefined, { login }) : []
  if (!found) throw new Error(`Twitch: no user named "${name}"`)
  return found
}

// Stops a pending sign-in; the account signed in before (if any) stays.
export function cancel() {
  polling++
  status.device = null
}

export async function logout() {
  polling++
  if (auth?.access) await post('revoke', { token: auth.access }).catch(() => {})
  auth = null
  await store.remove('settings', 'twitch-auth')
  show()
  Object.assign(status, { device: null, error: '' })
}
