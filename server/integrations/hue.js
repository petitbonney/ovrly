// Philips Hue integration: the bridge's local API (CLIP v2). Pairing (the bridge's link button) gets an app key and pins
// the bridge's certificate, so requests are checked against it (data/settings/hue.json). Commands are paced to what the
// bridge takes, and the routines playing live here, one per device, so Stop and Cancel can reach them.
import https from 'node:https'
import tls from 'node:tls'
import { Router } from 'express'
import { record } from '../bus.js'
import * as store from '../store.js'
import { unavailable } from '../errors.js'

export const status = { ip: '', connected: false, error: '' }
let settings = {} // { ip, key, cert }
let agent

// Routine guardrails, shared with the editor's warning (the Hue node's steps field): the shortest step on a light
// (also keeps flashes under 3 a second, the usual threshold for photosensitive viewers) and on a room or zone (the
// bridge takes about one group command a second), and the most steps.
export const limits = { light: 200, group: 1000, steps: 50 }

// Requests trust the certificate seen at pairing only: the bridge's own (self-signed, or signed by Signify's CA),
// whose name is the bridge's id rather than its IP, hence no name check.
const pinned = (cert) => new https.Agent({ ca: cert, allowPartialTrustChain: true, checkServerIdentity: () => undefined, keepAlive: true })

// (Re)connects with saved settings: checks the bridge answers with this key.
export async function connect(saved = {}) {
  settings = saved
  agent = saved.cert && pinned(saved.cert)
  Object.assign(status, { ip: saved.ip ?? '', connected: false, error: saved.key ? '' : saved.ip ? 'Not paired' : 'No bridge set' })
  if (!saved.key) return
  try {
    await request('GET', 'bridge')
    status.connected = true
  } catch (err) {
    status.error = err.message
  }
}

// The bridge's address, "ip" or "ip:port" (a bridge emulator such as diyHue may use another port than 443).
const address = (ip) => ({ host: ip.split(':')[0], port: ip.split(':')[1] ?? 443 })

// The certificate the bridge shows now, as PEM.
const certOf = (ip) => new Promise((resolve, reject) => {
  const socket = tls.connect({ ...address(ip), rejectUnauthorized: false, timeout: 5000 }, () => {
    const der = socket.getPeerCertificate().raw.toString('base64')
    socket.end()
    resolve(`-----BEGIN CERTIFICATE-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`)
  })
  socket.on('timeout', () => socket.destroy(new Error(`No Hue bridge answers at ${ip}`)))
  socket.on('error', reject)
})

// Pairs with the bridge at ip, once its link button was pressed: the settings to save, { ip, key, cert }.
export async function pair(ip) {
  const cert = await certOf(ip)
  const [answer] = (await call('POST', '/api', { devicetype: 'ovrly#ovrly' }, { ip, key: '', agent: pinned(cert) })).body
  if (answer?.error?.type === 101) throw new Error('Press the button on the bridge first, then Pair (within 30 seconds)')
  if (!answer?.success) throw new Error(answer?.error?.description ?? 'The bridge refused to pair')
  return { ip, key: answer.success.username, cert }
}

// One HTTPS request to the bridge: { status, body } (JSON).
function call(method, path, body, { ip = settings.ip, key = settings.key, agent: through = agent } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...(key && { 'hue-application-key': key }) }
    const req = https.request({ ...address(ip), path, method, agent: through, headers, timeout: 5000 }, (res) => {
      let text = ''
      res.setEncoding('utf8').on('data', (chunk) => (text += chunk)).on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }) } catch { reject(new Error(`Hue bridge answered ${res.statusCode}`)) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('Hue bridge: no answer')))
    req.on('error', reject)
    req.end(body && JSON.stringify(body))
  })
}

// A CLIP v2 request on a resource, e.g. request('GET', 'light'): its data list.
export async function request(method, resource, body) {
  if (!settings.key) throw new Error('Hue is not paired: pair it in Settings → Philips Hue')
  const { status: code, body: answer } = await call(method, `/clip/v2/resource/${resource}`, body)
  const error = answer.errors?.[0]?.description ?? (code >= 400 && `Hue bridge answered ${code}`)
  if (method !== 'GET') record('http', 'hue', { method, resource, ...body, ...(error && { error }) })
  if (error) throw new Error(`Hue: ${error}`)
  return answer.data
}

// Lights, rooms and zones, grouped for a picker: a light is "light/<id>", a room or zone its "grouped_light/<id>".
export async function devices() {
  const byName = (a, b) => a.label.localeCompare(b.label)
  const groups = (list) => list.map((g) => ({ value: `grouped_light/${g.services.find((s) => s.rtype === 'grouped_light')?.rid}`, label: g.metadata.name })).sort(byName)
  const [lights, rooms, zones] = await Promise.all(['light', 'room', 'zone'].map((r) => request('GET', r)))
  return [
    { group: 'Rooms', items: groups(rooms) },
    { group: 'Zones', items: groups(zones) },
    { group: 'Lights', items: lights.map((l) => ({ value: `light/${l.id}`, label: l.metadata.name })).sort(byName) },
  ]
}

// Commands are paced for the bridge, whoever sends them: one every 100ms, and one a second for rooms and zones.
let nextSlot = 0
let nextGroupSlot = 0
const sleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => resolve(clearTimeout(timer)), { once: true })
})
export async function send(target, body) {
  const group = target.startsWith('grouped_light/')
  const now = Date.now()
  const at = Math.max(now, nextSlot, group ? nextGroupSlot : 0)
  nextSlot = at + 100
  if (group) nextGroupSlot = at + 1000
  await sleep(at - now)
  return request('PUT', target, body)
}

// "#rrggbb" -> CIE xy, the color space of Hue lights (they keep it inside what they can show).
export function xy(hex) {
  const [r, g, b] = (hex.match(/^#([0-9a-f]{6})$/i)?.[1] ?? 'ffffff').match(/../g)
    .map((h) => parseInt(h, 16) / 255).map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92))
  const X = r * 0.664511 + g * 0.154324 + b * 0.162028
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047685
  const Z = r * 0.000088 + g * 0.07231 + b * 0.986039
  const sum = X + Y + Z
  return sum ? { x: +(X / sum).toFixed(4), y: +(Y / sum).toFixed(4) } : { x: 0.3127, y: 0.329 } // black: white's point
}

// The lights of a device: itself, or a room's (its devices' lights) or a zone's (its lights).
async function lightsOf(target) {
  const [kind, id] = target.split('/')
  const lights = await request('GET', 'light')
  if (kind === 'light') return lights.filter((l) => l.id === id)
  const [{ owner }] = await request('GET', target)
  const [{ children }] = await request('GET', `${owner.rtype}/${owner.rid}`)
  const ids = new Set(children.map((c) => c.rid))
  return lights.filter((l) => ids.has(l.id) || ids.has(l.owner.rid))
}

// What putting each light back as it is now takes: the commands, one per light.
const snapshot = (lights) => lights.map((l) => ({
  target: `light/${l.id}`,
  body: !l.on.on ? { on: { on: false } } : {
    on: { on: true },
    ...(l.dimming && { dimming: { brightness: l.dimming.brightness } }),
    ...(l.color_temperature?.mirek_valid ? { color_temperature: { mirek: l.color_temperature.mirek } } : l.color && { color: { xy: l.color.xy } }),
  },
}))

// Routines playing: device -> { node, saved (a promise of its snapshot), finish(how) }.
const playing = {}

// Plays a routine's steps ({ off, color, brightness, duration, transition }, clamped already) rounds times on a
// device, for a node (its workflow/node key), and resolves with how it ended: end, stop, cancel (or the workflow's
// signal aborted), or replaced (another routine took the device). Stop and Cancel put the lights back as they were
// (Stop with a fade, over transition, or the bridge's own 400ms), the end too when restore is set; a routine replaced
// leaves that to the one replacing it, which keeps its snapshot.
export async function play(target, { steps, rounds, transition, restore }, node, signal) {
  const previous = playing[target]
  previous?.finish('replaced')
  const saved = previous?.saved ?? lightsOf(target).then(snapshot)
  saved.catch(() => {}) // awaited below
  const halt = new AbortController()
  let how = 'end'
  const me = { node, saved, finish: (why) => halt.signal.aborted || (how = why, halt.abort()) }
  playing[target] = me
  const cancel = () => me.finish('cancel')
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await saved
    for (let round = 0; round < rounds && !halt.signal.aborted; round++) {
      for (const step of steps) {
        if (halt.signal.aborted) break
        await send(target, step.off ? { on: { on: false }, dynamics: { duration: step.transition } } : {
          on: { on: true }, dimming: { brightness: step.brightness }, color: { xy: xy(step.color) }, dynamics: { duration: step.transition },
        })
        await sleep(step.duration, halt.signal)
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    if (playing[target] === me) delete playing[target]
  }
  if (how === 'replaced' || (how === 'end' && !restore)) return how
  const duration = how === 'cancel' ? 0 : how === 'stop' ? transition || 400 : transition
  for (const { target: light, body } of await saved) await send(light, { ...body, dynamics: { duration } })
  return how
}

// Stop or Cancel (how) on a node's routine, from its settings pane: false if none plays.
export function end(node, how) {
  const routine = Object.values(playing).find((r) => r.node === node)
  routine?.finish(how)
  return !!routine
}

// Routes (Settings → Philips Hue): its status, pairing with the bridge at an IP (its link button pressed first), the
// devices for the node's picker, and Stop or Cancel on a Hue node's routine.
export const routes = Router()
routes.get('/api/hue', (req, res) => res.json(status))
routes.post('/api/hue/pair', async (req, res) => {
  const ip = String(req.body.ip ?? '').trim()
  try {
    const settings = await pair(ip)
    await store.save('settings', { id: 'hue', ...settings })
    await connect(settings)
  } catch (err) {
    Object.assign(status, { ip, error: err.message })
  }
  res.json(status)
})
routes.get('/api/hue/devices', async (req, res) => res.json(await devices().catch(unavailable)))
routes.post('/api/hue/routines/:workflow/:node/:how', (req, res) => {
  if (!['stop', 'cancel'].includes(req.params.how)) return res.sendStatus(400)
  res.sendStatus(end(`${req.params.workflow}/${req.params.node}`, req.params.how) ? 204 : 404)
})
