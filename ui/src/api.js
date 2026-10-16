// Fetch helpers for the server's JSON API.
export const get = (path) => fetch(path).then((r) => r.json())
// Request options with a JSON body, e.g. fetch(path, json('PUT', item)).
export const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
