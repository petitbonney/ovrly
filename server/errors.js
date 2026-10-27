// HTTP errors for the /api error handler (index.js): a status says an error is the request's (4xx) or an outside
// service's (502, 503); an error without one is Ovrly's own (500, logged).
export const httpError = (status, message) => Object.assign(new Error(message), { status })

// For a call to an outside service (OBS, Giphy, the Hue bridge…): its failure is a 503, unless it says otherwise.
export function unavailable(err) {
  throw Object.assign(err, { status: err.status ?? 503 })
}
