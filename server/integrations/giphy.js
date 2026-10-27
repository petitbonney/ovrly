// Giphy integration: the API key and whether Giphy accepts it (checked on startup and on save), and the search the
// GIPHY node and its picker run.
import { Router } from 'express'
import * as store from '../store.js'

export const status = { key: '', connected: false, error: '' }

export async function connect({ key = '' } = {}) {
  Object.assign(status, { key, connected: false, error: key ? '' : 'No API key set' })
  if (!key) return
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/trending?limit=1&api_key=${encodeURIComponent(key)}`)
    status.connected = res.ok
    status.error = res.ok ? '' : res.status === 401 || res.status === 403 ? 'Invalid API key' : `Giphy answered ${res.status}`
  } catch (err) {
    status.error = err.message
  }
}

// A clip is a GIF with sound: its MP4 (best size first). The clips endpoints need an API key Giphy approved for them.
const clipVideo = (g) => {
  const a = g.video?.assets ?? {}
  return (a['720p'] ?? a['360p'] ?? a.source)?.url ?? g.images.original_mp4?.mp4 ?? g.images.original.mp4
}

// A page of GIFs, stickers (transparent GIFs) or clips (kind): the search results, or the trending ones without a query.
export async function search(q, offset, kind = 'gif', rating = 'pg') {
  const clips = kind === 'clip'
  if (!status.key) throw new Error('Set the Giphy API key first (Settings → Giphy)')
  const url = new URL(`https://api.giphy.com/v1/${kind}s/${q ? 'search' : 'trending'}`)
  url.search = new URLSearchParams({ api_key: status.key, q, offset, limit: 24, rating })
  const res = await fetch(url)
  if (clips && res.status === 403) throw new Error('Giphy refused: clips need your API key approved (email clips@giphy.com)')
  if (!res.ok) throw new Error(`Giphy answered ${res.status}`)
  const { data } = await res.json()
  return data.map((g) => ({ id: g.id, title: g.title, url: clips ? clipVideo(g) : g.images.original.url, preview: g.images.fixed_width.url }))
}

// Routes (Settings → Giphy): its API key and status (saving re-checks the key); and the GIPHY node's picker: trending
// GIFs (or ?kind=sticker, clip) or search results, 24 at a time.
export const routes = Router()
routes.get('/api/giphy', (req, res) => res.json(status))
routes.put('/api/giphy', async (req, res) => {
  const settings = { key: String(req.body.key ?? '').trim() }
  await store.save('settings', { id: 'giphy', ...settings })
  await connect(settings)
  res.json(status)
})
routes.get('/api/giphy/search', (req, res) =>
  search(String(req.query.q ?? ''), Number(req.query.offset) || 0, req.query.kind, req.query.rating).then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))
