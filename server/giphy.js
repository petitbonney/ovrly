// Giphy integration: the API key and whether Giphy accepts it (checked on startup and on save).
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

// A page of GIFs for the picker: the search results, or the trending ones without a query.
export async function search(q, offset) {
  if (!status.key) throw new Error('Set the Giphy API key first (Integration → Giphy)')
  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}`)
  url.search = new URLSearchParams({ api_key: status.key, q, offset, limit: 24, rating: 'pg-13' })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Giphy answered ${res.status}`)
  const { data } = await res.json()
  return data.map((g) => ({ id: g.id, title: g.title, url: g.images.original.url, preview: g.images.fixed_width.url }))
}
