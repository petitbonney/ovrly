// Action: sends an HTTP request ({{key}} placeholders filled from data). Adds { status, response, json } (json: the
// response parsed, if it is JSON, e.g. {{json.items.0.name}}). Each request is
// recorded as an `http-request` event (GET /api/events).
import { fill, fillJson, fillUrl } from '../template.js'
import { record } from '../bus.js'

export default {
  type: 'http-request',
  label: 'HTTP Request',
  icon: 'world',
  category: 'action',
  group: 'System',
  play: true,
  description: 'Sends an HTTP request.',
  adds: ['status', 'response', 'json'],
  fields: {
    method: { options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    url: { label: 'URL', vars: true },
    headers: { type: 'json', label: 'Headers (JSON)', hint: 'e.g. {"Authorization": "Bearer {{token}}"}', info: 'Content-Type is JSON unless set here.' },
    body: { vars: true, multiline: true },
  },
  config: { method: 'POST', url: 'http://localhost:8080', headers: '{}', body: '{"user":"{{user}}"}' },
  async run({ config, data, signal }) {
    const method = config.method.toUpperCase()
    const hasBody = !['GET', 'HEAD'].includes(method)
    const url = fillUrl(config.url, data)
    const headers = new Headers(hasBody ? { 'Content-Type': 'application/json' } : {})
    try {
      for (const [name, v] of Object.entries(JSON.parse(fillJson(config.headers || '{}', data)))) headers.set(name, v)
    } catch {
      throw new Error('HTTP Request: the headers are not valid JSON')
    }
    // A JSON body gets its values escaped; another type (set in the headers) takes them as they are.
    const body = hasBody ? (/json/i.test(headers.get('Content-Type')) ? fillJson : fill)(config.body, data) : undefined
    const res = await fetch(url, { method, headers, body, signal }).catch((err) => {
      record('http', 'http-request', { method, url, error: err.message })
      throw err
    })
    record('http', 'http-request', { method, url, ...(body && { body }), status: res.status })
    const response = await res.text()
    let json
    try { json = JSON.parse(response) } catch {}
    return { ...data, status: res.status, response, json }
  },
}
