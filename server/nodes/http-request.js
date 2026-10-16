// Action: sends an HTTP request ({{key}} placeholders filled from data). Adds { status, response }. Each request is
// recorded as an `http-request` event (GET /api/events).
import { fill } from '../template.js'
import { record } from '../bus.js'

export default {
  type: 'http-request',
  label: 'HTTP Request',
  category: 'action',
  description: 'Sends an HTTP request.',
  adds: ['status', 'response'],
  fields: {
    method: { options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    url: { label: 'URL', vars: true },
    body: { vars: true, multiline: true },
  },
  config: { method: 'POST', url: 'http://localhost:8080', body: '{"user":"{{user}}"}' },
  async run({ config, data, signal }) {
    const method = config.method.toUpperCase()
    const hasBody = !['GET', 'HEAD'].includes(method)
    const url = fill(config.url, data)
    const body = hasBody ? fill(config.body, data) : undefined
    const headers = hasBody ? { 'Content-Type': 'application/json' } : {}
    const res = await fetch(url, { method, headers, body, signal }).catch((err) => {
      record('http', 'http-request', { method, url, error: err.message })
      throw err
    })
    record('http', 'http-request', { method, url, ...(body && { body }), status: res.status })
    return { ...data, status: res.status, response: await res.text() }
  },
}
