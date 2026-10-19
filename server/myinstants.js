// Myinstants search for the MyInstants node and its picker: there is no API, so this reads the search page's HTML. If the site
// changes its markup, only the regex below breaks.
const HOST = 'https://www.myinstants.com'
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot);/gi, (m, e) =>
  ({ amp: '&', lt: '<', gt: '>', quot: '"' })[e] ?? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))))

// One page (36 results) of sounds matching q, or of the trending ones without q, as [{ id, title, url }]. Each result has a play('/media/sounds/x.mp3', …) button.
export async function search(q, page) {
  const url = q ? `${HOST}/en/search/?${new URLSearchParams({ name: q, page })}` : `${HOST}/en/index/fr/?page=${page}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Myinstants answered ${res.status}`)
  const html = await res.text()
  const found = html.matchAll(/play\('(\/media\/sounds\/[^']+)', '[^']*', '([^']+)'\)[\s\S]*?class="instant-link[^>]*>([^<]+)</g)
  return [...found].map(([, path, id, title]) => ({ id, title: decode(title.trim()), url: HOST + path }))
}
