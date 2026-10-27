// Stream Deck integration: the Ovrly plugin (streamdeck/) gets the buttons of every Control Pad node set to the
// Stream Deck controller, drawn as key images, says which keys show which button (pairing), and sends presses, which
// fire that node alone.
import { Router } from 'express'
import { record } from './bus.js'
import { fire } from './engine.js'
import * as store from './store.js'
import deck from './nodes/deck.js'
import { iconNode } from './icons.js'

// connected: the plugin is listening; devices: id -> { name, columns, rows }; keys: the paired keys,
// [{ context, device, column, row, workflow, node, button }] (no column or row for a key in a multi action).
export const status = { connected: false, devices: {}, keys: [] }
const clients = new Map() // the plugin's open streams -> the decks last sent on it, as JSON

// Images go raw in a data URL, so no "#" (it would end the URL): named entities, and colors as rgb().
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])
const rgb = (hex) => (/^#[0-9a-f]{6}$/i.test(hex) ? `rgb(${hex.slice(1).match(/../g).map((h) => parseInt(h, 16))})` : 'gray')

// A key image (144px SVG): the button's color, its icon and name in white; faded while its workflow is off.
async function keyImage(button, on) {
  const icon = ((await iconNode(button.icon)) ?? (await iconNode('star'))) // a star if there is no such icon
    .map(([tag, { key, ...attrs }]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('')
  const name = button.name.length > 12 ? `${button.name.slice(0, 11)}…` : button.name
  const size = name.length > 8 ? 17 : 22
  return `data:image/svg+xml;charset=utf8,<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
    + `<rect width="144" height="144" fill="black"/><g opacity="${on ? 1 : 0.3}"><rect width="144" height="144" fill="${rgb(button.color)}"/>`
    + `<g transform="translate(44 ${name ? 22 : 44}) scale(2.333)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</g>`
    + `<text x="72" y="122" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${size}" fill="white">${esc(name)}</text></g></svg>`
}

// A node's config if it is a Control Pad node on the Stream Deck mode (not Companion).
function pluginDeck(node) {
  if (node?.data.type !== 'deck') return null
  const config = { ...deck.config, ...node.data.config }
  return config.mode === 'streamdeck' ? config : null
}

// The plugin's decks: [{ workflow, name (the workflow's), enabled, node, buttons: [{ id, name, image }] }].
async function decks() {
  const list = []
  for (const workflow of await store.list('workflows')) {
    for (const node of (workflow.nodes ?? []).filter(pluginDeck)) {
      const on = workflow.enabled !== false
      const buttons = await Promise.all(pluginDeck(node).buttons.map(async (b) => ({ id: b.id, name: b.name, image: await keyImage(b, on) })))
      list.push({ workflow: workflow.id, name: workflow.name, enabled: on, node: node.id, buttons })
    }
  }
  return list
}

// Sends the decks to the plugin's streams that don't have them yet: when one connects, and after a workflow is saved or
// deleted (server/workflows.js). One at a time, so an older list can't arrive after a newer one.
let sending = Promise.resolve()
export function push() {
  sending = sending.then(async () => {
    const data = JSON.stringify(await decks())
    for (const [res, last] of clients) if (data !== last) clients.set(res, data), res.write(`data: ${data}\n\n`)
  }).catch((err) => console.error('[streamdeck]', err)) // not awaited by callers: a rejection would crash the server
}

// The plugin's stream (SSE): the decks now, then again whenever they change.
export function listen(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  clients.set(res, '')
  status.connected = true
  record('sse', 'streamdeck-connected', {})
  push()
  req.on('close', () => {
    clients.delete(res)
    if (!clients.size) Object.assign(status, { connected: false, devices: {}, keys: [] })
  })
}

// The plugin's devices and paired keys, sent whenever they change.
export function report({ devices = {}, keys = [] }) {
  Object.assign(status, { devices, keys })
}

// A key (or the node's grid) pressed: fires its button on that node alone, unless the button is gone, the node is set
// to Companion, or its workflow is off.
export async function press({ workflow: id, node: nodeId, button }) {
  const workflow = await store.get('workflows', id).catch(() => null)
  const config = pluginDeck(workflow?.nodes?.find((n) => n.id === nodeId))
  if (!config?.buttons.some((b) => b.id === button)) return { ok: false, error: 'This button is gone' }
  if (workflow.enabled === false) return { ok: false, error: 'This workflow is off' }
  record('http', 'streamdeck', { workflow: id, node: nodeId, button })
  fire(workflow, 'streamdeck', { button }, {}, nodeId)
  return { ok: true }
}

// Routes (Settings → Stream Deck): its status (plugin connected, devices, paired keys), and the plugin's link: the decks
// stream, its paired keys, and key presses.
export const routes = Router()
routes.get('/api/streamdeck', (req, res) => res.json(status))
routes.get('/api/streamdeck/events', listen)
routes.post('/api/streamdeck/keys', (req, res) => {
  report(req.body)
  res.sendStatus(204)
})
routes.post('/api/streamdeck/press', async (req, res) => res.json(await press(req.body)))
// The packed plugin to install (made by pnpm streamdeck:pack; release zips have it).
routes.get('/streamdeck/com.ovrly.deck.streamDeckPlugin', (req, res) => res.download('streamdeck/com.ovrly.deck.streamDeckPlugin', (err) =>
  err && !res.headersSent && res.status(404).send('Not packed yet: run pnpm streamdeck:pack')))
