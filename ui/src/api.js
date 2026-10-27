// Fetch helpers for the server's JSON API.
// get rejects an error answer (with its { error } message, or the status text), so it is never taken for data.
export const get = (path) => fetch(path).then(async (r) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText)
  return r.json()
})
// Request options with a JSON body, e.g. fetch(path, json('PUT', item)).
export const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
