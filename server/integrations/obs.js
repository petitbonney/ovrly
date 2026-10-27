// OBS integration: one obs-websocket v5 connection on Node's built-in WebSocket, set up from the sidebar
// (data/settings/obs.json). It reconnects every 5s while OBS is closed. OBS nodes send their requests through it, and
// the settings pane lists scenes and sources from it. Connecting, disconnecting and each request are recorded as
// `obs` events (GET /api/events).
import crypto from 'node:crypto'
import { Router } from 'express'
import { record } from '../bus.js'
import * as store from '../store.js'
import { unavailable } from '../errors.js'

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('base64')
export const status = { url: '', password: '', connected: false, error: '' }
let socket = null // { ws, pending } once OBS has accepted us
let generation = 0 // bumped on each connect(), so an old socket's events are ignored
let retry

// (Re)connects with new settings; an empty URL just disconnects.
export function connect({ url = '', password = '' }) {
  const gen = ++generation
  clearTimeout(retry)
  socket?.ws.close()
  socket = null
  Object.assign(status, { url, password, connected: false, error: '' })
  if (url) open(gen)
}

function open(gen) {
  const ws = new WebSocket(status.url)
  const pending = new Map()
  ws.onerror = () => {} // the close event that follows says why
  ws.onclose = (e) => {
    if (gen !== generation) return
    if (status.connected) record('websocket', 'obs', { url: status.url, connected: false })
    socket = null
    Object.assign(status, { connected: false, error: e.reason || 'cannot connect (is OBS open, with its WebSocket server on?)' })
    retry = setTimeout(() => open(gen), 5000)
  }
  ws.onmessage = ({ data }) => {
    const { op, d } = JSON.parse(data)
    if (op === 0) { // Hello: identify, answering the auth challenge if OBS requires a password.
      const auth = d.authentication && sha256(sha256(status.password + d.authentication.salt) + d.authentication.challenge)
      ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: auth, eventSubscriptions: 0 } }))
    }
    if (op === 2 && gen === generation) { // Identified
      socket = { ws, pending }
      Object.assign(status, { connected: true, error: '' })
      record('websocket', 'obs', { url: status.url, connected: true })
    }
    if (op === 7) pending.get(d.requestId)?.(d) // RequestResponse
  }
}

// Sends one request, e.g. request('SetCurrentProgramScene', { sceneName }).
export async function request(requestType, requestData = {}) {
  if (!socket) throw new Error('OBS is not connected: check Settings → OBS')
  const { ws, pending } = socket
  const requestId = crypto.randomUUID()
  const d = await new Promise((resolve, reject) => {
    pending.set(requestId, resolve)
    setTimeout(() => reject(new Error(`OBS ${requestType}: no answer`)), 5000)
    ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }))
  }).finally(() => pending.delete(requestId))
  record('websocket', 'obs', { request: requestType, ...requestData, ...(d.requestStatus.result ? {} : { error: d.requestStatus.comment }) })
  if (!d.requestStatus.result) throw new Error(`OBS ${requestType}: ${d.requestStatus.comment}`)
  return d.responseData
}

// Scene names, and the source names in a scene, top to bottom as in OBS (which lists them bottom-up).
export const scenes = async () => (await request('GetSceneList')).scenes.map((s) => s.sceneName).reverse()
export const sources = async (sceneName) => (await request('GetSceneItemList', { sceneName })).sceneItems.map((i) => i.sourceName).reverse()

// Routes (Settings → OBS): its settings and status (saving reconnects), and the scene and source lists for node settings.
export const routes = Router()
routes.get('/api/obs', (req, res) => res.json(status))
routes.put('/api/obs', async (req, res) => {
  const settings = { url: String(req.body.url ?? '').trim(), password: String(req.body.password ?? '') }
  await store.save('settings', { id: 'obs', ...settings })
  connect(settings)
  res.json(status)
})
routes.get('/api/obs/scenes', async (req, res) => res.json(await scenes().catch(unavailable)))
routes.get('/api/obs/sources', async (req, res) => res.json(await sources(String(req.query.scene ?? '')).catch(unavailable)))
