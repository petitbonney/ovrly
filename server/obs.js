// Minimal obs-websocket v5 client on Node's built-in WebSocket: auth, then request/response. Each request and its
// outcome is recorded as an `obs` event (GET /api/events).
import crypto from 'node:crypto'
import { record } from './bus.js'

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('base64')
const sockets = {} // url -> Promise<{ ws, pending }>, reused across calls

function connect(url, password) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    ws.onerror = () => {
      record('websocket', 'obs', { url, error: 'cannot connect' })
      reject(new Error(`OBS: cannot connect to ${url}`))
    }
    ws.onclose = () => delete sockets[url]
    ws.onmessage = ({ data }) => {
      const { op, d } = JSON.parse(data)
      if (op === 0) { // Hello: identify, answering the auth challenge if OBS requires a password.
        const auth = d.authentication && sha256(sha256(password + d.authentication.salt) + d.authentication.challenge)
        ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication: auth, eventSubscriptions: 0 } }))
      }
      if (op === 2) { // Identified: from now on, an error means the connection was lost
        ws.onerror = () => record('websocket', 'obs', { url, error: 'connection lost' })
        resolve({ ws, pending })
      }
      if (op === 7) pending.get(d.requestId)?.(d) // RequestResponse
    }
  })
}

// Sends one request, e.g. request(url, password, 'SetCurrentProgramScene', { sceneName }).
export async function request(url, password, requestType, requestData = {}) {
  sockets[url] ??= connect(url, password).catch((err) => { delete sockets[url]; throw err })
  const { ws, pending } = await sockets[url]
  const requestId = crypto.randomUUID()
  const d = await new Promise((resolve) => {
    pending.set(requestId, resolve)
    ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }))
  })
  pending.delete(requestId)
  record('websocket', 'obs', { url, request: requestType, ...requestData, ...(d.requestStatus.result ? {} : { error: d.requestStatus.comment }) })
  if (!d.requestStatus.result) throw new Error(`OBS ${requestType}: ${d.requestStatus.comment}`)
  return d.responseData
}
