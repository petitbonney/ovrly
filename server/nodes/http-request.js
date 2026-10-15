// Action: sends an HTTP request ({key} placeholders filled from data). Adds { status, response }.
import { fill } from '../template.js'

export default {
  type: 'http-request',
  label: 'HTTP request',
  category: 'action',
  config: { method: 'POST', url: 'http://localhost:8080', body: '{"user":"{user}"}' },
  async run({ config, data }) {
    const method = config.method.toUpperCase()
    const hasBody = !['GET', 'HEAD'].includes(method)
    const res = await fetch(fill(config.url, data), {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? fill(config.body, data) : undefined,
    })
    return { ...data, status: res.status, response: await res.text() }
  },
}
