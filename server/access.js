// Who reaches Ovrly: this computer; with "Open to LAN" on (Settings → Network), other devices too, for widget pages and
// API calls, and for the editor and its API with the LAN key (its link there sets it as a cookie). Turning LAN on makes
// a new key, which signs the other devices out.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import net from 'node:net'
import os from 'node:os'
import * as store from './store.js'

const newKey = () => randomBytes(18).toString('base64url')
let { lan = false, key = '' } = (await store.get('settings', 'network')) ?? {}
if (lan && !key) await store.save('settings', { id: 'network', lan, key: (key = newKey()) })
const OPEN = /^\/(w|m|widgets|vendor|hooks|file|streamdeck)(\/|$)/ // widget pages and what they load, API calls
const local = (req) => /^(::1|(::ffff:)?127\.0\.0\.1)$/.test(req.socket.remoteAddress)
const same = (a = '', b = '') => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}
const cookieKey = (req) => /(?:^|;\s*)ovrly-key=([^;]*)/.exec(req.get('cookie') ?? '')?.[1]
// Browsers send requests on other websites' behalf, so they must name Ovrly by an address or this computer's name (a
// website could point its own domain at this computer: DNS rebinding) and come from Ovrly's own pages, but for a link
// opening one of them (CSRF). Sec-Fetch-Site says where a request comes from; older browsers only send Origin.
const name = os.hostname().toLowerCase()
const knownHost = (req) => net.isIP((req.hostname ?? '').replace(/^\[(.*)\]$/, '$1'))
  || ['localhost', name, `${name}.local`].includes(req.hostname?.toLowerCase())
function foreign(req) {
  const site = req.get('sec-fetch-site')
  if (site) return site !== 'same-origin' && site !== 'none'
  return !!req.get('origin') && req.get('origin') !== `http://${req.get('host')}`
}
const link = (req) => req.method === 'GET' && req.get('sec-fetch-mode') === 'navigate' && !/^\/(api|hooks)(\/|$)/.test(req.path)

// Express middleware, ahead of every route.
export function access(req, res, next) {
  if (!knownHost(req) || (foreign(req) && !link(req))) return res.sendStatus(403)
  if (local(req) || (lan && OPEN.test(req.path))) return next()
  if (!lan) return res.sendStatus(403)
  if (same(String(req.query.key ?? ''), key)) {
    res.cookie('ovrly-key', key, { httpOnly: true, sameSite: 'strict', maxAge: 365 * 864e5 })
    const url = new URL(req.originalUrl, 'http://ovrly')
    url.searchParams.delete('key')
    return res.redirect(url.pathname + url.search)
  }
  if (same(cookieKey(req), key)) return next()
  const error = 'Open Ovrly from the editor link in Settings → Network, on the computer running it'
  req.path.startsWith('/api/') ? res.status(401).json({ error }) : res.status(401).type('text').send(error)
}

// Settings → Network: whether LAN is on, its key (for the editor link) and this computer's addresses.
export const network = () => ({
  lan, key: lan ? key : '',
  addresses: Object.values(os.networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address),
})

// Turns LAN on (with a new key) or off.
export async function setLan(on) {
  if (on && !lan) key = newKey()
  lan = !!on
  await store.save('settings', { id: 'network', lan, key })
}
