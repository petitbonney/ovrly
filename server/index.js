// Server entry: REST API over the store, widget pages, plus the UI (Vite in dev, ./dist in production).
import path from 'node:path'
import { execFile } from 'node:child_process'
import os from 'node:os'
import express from 'express'
import * as store from './store.js'
import bus, { recent, record } from './bus.js'
import { nodes, fire, cancel, running, activity, history, line, drop } from './engine.js'
import * as twitch from './sources/twitch.js'
import * as twitchAuth from './sources/twitch-auth.js'
import * as eventsub from './sources/twitch-eventsub.js'
import * as obs from './obs.js'
import * as giphy from './giphy.js'
import * as hue from './hue.js'
import * as streamdeck from './streamdeck.js'
import * as myinstants from './myinstants.js'
import * as fonts from './fonts.js'
import * as widgets from './widgets.js'
import * as windows from './windows.js'
import { vars, saveVars } from './vars.js'

const PORT = process.env.PORT || 6875 // OVRL on a phone keypad
const app = express()
// Only this computer reaches Ovrly unless "Open to LAN" is on (Settings → Network).
let lan = !!(await store.get('settings', 'network'))?.lan
app.use((req, res, next) => /^(::1|(::ffff:)?127\.0\.0\.1)$/.test(req.socket.remoteAddress) || lan ? next() : res.sendStatus(403))
app.use(express.json())

// Node types for the UI library (metadata only, no run function).
app.get('/api/nodes', (req, res) => res.json(Object.values(nodes).map(({ run, ...meta }) => meta)))
// Play in an action node's settings (node types with `play`): runs the node once with the editor's config { type, config },
// outside any workflow run and with no data (only {{ $vars }} fill), and answers { out } (null: stopped) or { error }.
// Stop aborts it, as cancelling a workflow would (e.g. Switch Scene switches back at once).
const plays = {} // workflow/node -> AbortController
app.post('/api/nodes/:workflow/:node/play', async (req, res) => {
  const def = nodes[req.body.type]
  if (!def?.play) return res.sendStatus(400)
  const id = `${req.params.workflow}/${req.params.node}`
  plays[id]?.abort()
  const controller = (plays[id] = new AbortController())
  try {
    const out = await def.run({ config: { ...def.config, ...req.body.config }, data: {}, id, signal: controller.signal })
    res.json({ out: controller.signal.aborted ? null : out ?? null })
  } catch (err) {
    res.json(controller.signal.aborted ? { out: null } : { error: err.message })
  } finally {
    if (plays[id] === controller) delete plays[id]
  }
})
app.post('/api/nodes/:workflow/:node/stop', (req, res) => {
  plays[`${req.params.workflow}/${req.params.node}`]?.abort()
  res.sendStatus(204)
})
// Fire a fake event on the bus, e.g. POST /api/emit/chat { user, message }.
app.post('/api/emit/:event', (req, res) => {
  bus.emit(req.params.event, req.body)
  res.sendStatus(204)
})

// Live run feedback for the workflow editor: an SSE stream of the engine's node and link activity, and { widget: id }
// when an action changed a widget's state.
app.get('/api/activity', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
  const send = (a) => res.write(`data: ${JSON.stringify(a)}\n\n`)
  for (const [workflow, count] of Object.entries(running())) send({ workflow, running: count })
  activity.on('activity', send)
  req.on('close', () => activity.off('activity', send))
})
// Queue nodes: the firings waiting in line, and removing one (it stops there).
app.get('/api/queues/:workflow/:node', (req, res) => res.json(line(req.params.workflow, req.params.node)))
app.delete('/api/queues/:workflow/:node/:entry', (req, res) =>
  res.sendStatus(drop(req.params.workflow, req.params.node, Number(req.params.entry)) ? 204 : 404))
// Developer view: the recent events (chat, API calls, manual runs…), newest first. Browsers get a live table
// (events.html), anything else the JSON; ?format=json forces JSON.
app.get('/api/events', (req, res) => {
  if (req.query.format !== 'json' && req.accepts(['json', 'html']) === 'html') return res.sendFile('server/events.html', { root: '.' })
  res.type('json').send(JSON.stringify(recent, null, 2))
})
// Run history: the recent firings with what each node got and returned, newest first; ?workflow=<id> for one workflow.
app.get('/api/runs', (req, res) => res.json(history.filter((r) => !req.query.workflow || r.workflow === req.query.workflow)))
// A test chat message, for the bolt on a chat trigger: from TestViewer, with the trigger's command if it has one, and the
// role and first message it asks for, so the test gets through.
const testChat = (config) => ({
  user: 'TestViewer', login: 'testviewer', message: config.command || 'Hello from Ovrly!', channel: twitch.status.channel, messageId: '',
  userId: '', color: '', timestamp: Date.now(), broadcaster: config.from === 'broadcaster', mod: config.from === 'mod',
  vip: config.from === 'vip', sub: config.from === 'sub', subMonths: config.from === 'sub' ? 1 : 0, firstMessage: !!config.firstOnly,
  returning: false, emotes: [], action: false, highlighted: false, rewardId: '', replyToId: '', replyToUser: '', replyToMessage: '',
})
// Runs a workflow's manual triggers now (the Run button in the editor), or just ?node=<id> (the bolt on a trigger): a
// manual trigger, or a chat trigger, sent a test message.
app.post('/api/workflows/:id/run', async (req, res) => {
  const workflow = await store.get('workflows', req.params.id).catch(() => null)
  if (!workflow) return res.sendStatus(404)
  const node = workflow.nodes.find((n) => n.id === req.query.node)
  const chat = node && [nodes[node.data.type]?.event].flat().includes('chat')
  record('http', 'manual', { workflow: workflow.id, ...(chat && { test: 'chat' }) }) // not on the bus: it targets this workflow only
  fire(workflow, chat ? 'chat' : 'manual', chat ? testChat({ ...nodes[node.data.type].config, ...node.data.config }) : {}, {}, req.query.node)
  res.sendStatus(204)
})
// Cancels a workflow's firings in progress (the Cancel button in the editor); the workflow stays on.
app.post('/api/workflows/:id/cancel', (req, res) => {
  cancel(req.params.id)
  res.sendStatus(204)
})
// Emergency stop: switches every workflow off and cancels what is running. Answers with the ids it switched off
// ({ off }), for the editor to offer turning them back on.
app.post('/api/stop', async (req, res) => {
  const off = []
  for (const workflow of await store.list('workflows')) {
    if (workflow.enabled !== false) {
      await store.save('workflows', { ...workflow, enabled: false })
      off.push(workflow.id)
    }
    cancel(workflow.id)
  }
  record('http', 'stop-all', {})
  res.json({ off })
})
// API call trigger: any request to /hooks/<path> fires the matching nodes; the query and JSON body become data.
// /hooks/<path>/<button> is a Control Pad node's button (path "<path>/<button>", which no API Call node matches).
app.all('/hooks/:path{/:button}', (req, res) => {
  bus.emit('webhook', { ...req.query, ...req.body, path: [req.params.path, req.params.button].filter(Boolean).join('/') })
  res.sendStatus(204)
})

// Twitch: the mode (guest or streamer) and guest channel settings, saving them reconnects; and the streamer sign-in.
const twitchStatus = () => ({ ...twitch.status, streamer: twitch.streamer(), account: twitchAuth.status, eventsub: eventsub.status })
app.get('/api/twitch', (req, res) => res.json(twitchStatus()))
app.put('/api/twitch', async (req, res) => {
  const settings = { mode: req.body.mode === 'streamer' ? 'streamer' : 'guest', channel: String(req.body.channel || '').trim().toLowerCase().replace(/^#/, '') }
  await store.save('settings', { id: 'twitch', ...settings })
  await twitch.apply(settings)
  res.json(twitchStatus())
})
// The channel's reward titles, for the Channel Points trigger's picker.
app.get('/api/twitch/rewards', async (req, res) => {
  try {
    twitch.needStreamer('Channel points rewards')
    const rewards = await twitchAuth.helix('GET', 'channel_points/custom_rewards', undefined, { broadcaster_id: twitchAuth.status.userId })
    res.json(rewards.map((r) => r.title).sort())
  } catch (err) { res.status(503).json({ error: err.message }) }
})
// Starts a sign-in (the dialog then shows the code to approve), cancels a pending one, or signs out.
app.post('/api/twitch/login', (req, res) =>
  twitchAuth.start(() => twitch.apply()).then(() => res.json(twitchStatus()), (err) => res.status(502).json({ error: err.message })))
app.post('/api/twitch/login/cancel', (req, res) => {
  twitchAuth.cancel()
  res.json(twitchStatus())
})
app.delete('/api/twitch/login', async (req, res) => {
  await twitchAuth.logout()
  await twitch.apply()
  res.json(twitchStatus())
})

// OBS integration: its settings and status (saving reconnects), and the scene and source lists for node settings.
const network = () => ({
  lan, port: PORT,
  addresses: Object.values(os.networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address),
})
app.get('/api/network', (req, res) => res.json(network()))
app.put('/api/network', async (req, res) => {
  lan = !!req.body.lan
  await store.save('settings', { id: 'network', lan })
  res.json(network())
})
// Workflow variables (Settings → Variables): the list, and set or delete one by name.
app.get('/api/vars', (req, res) => res.json(vars))
app.put('/api/vars/:name', async (req, res) => {
  if (!/^[\w-]+$/.test(req.params.name)) return res.status(400).json({ error: 'The name takes letters, digits, "_" and "-"' })
  vars[req.params.name] = req.body.value
  await saveVars()
  res.json(vars)
})
app.delete('/api/vars/:name', async (req, res) => {
  delete vars[req.params.name]
  await saveVars()
  res.json(vars)
})
app.get('/api/obs', (req, res) => res.json(obs.status))
app.put('/api/obs', async (req, res) => {
  const settings = { url: String(req.body.url ?? '').trim(), password: String(req.body.password ?? '') }
  await store.save('settings', { id: 'obs', ...settings })
  obs.connect(settings)
  res.json(obs.status)
})
app.get('/api/obs/scenes', (req, res) => obs.scenes().then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))
app.get('/api/obs/sources', (req, res) =>
  obs.sources(String(req.query.scene ?? '')).then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))

// Giphy integration: its API key and status (saving re-checks the key).
app.get('/api/giphy', (req, res) => res.json(giphy.status))
app.put('/api/giphy', async (req, res) => {
  const settings = { key: String(req.body.key ?? '').trim() }
  await store.save('settings', { id: 'giphy', ...settings })
  await giphy.connect(settings)
  res.json(giphy.status)
})
// Hue integration: its status, pairing with the bridge at an IP (its link button pressed first), the devices for the
// node's picker, and Stop or Cancel on a Hue node's routine.
app.get('/api/hue', (req, res) => res.json(hue.status))
app.post('/api/hue/pair', async (req, res) => {
  const ip = String(req.body.ip ?? '').trim()
  try {
    const settings = await hue.pair(ip)
    await store.save('settings', { id: 'hue', ...settings })
    await hue.connect(settings)
  } catch (err) {
    Object.assign(hue.status, { ip, error: err.message })
  }
  res.json(hue.status)
})
app.get('/api/hue/devices', (req, res) => hue.devices().then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))
app.post('/api/hue/routines/:workflow/:node/:how', (req, res) => {
  if (!['stop', 'cancel'].includes(req.params.how)) return res.sendStatus(400)
  res.sendStatus(hue.end(`${req.params.workflow}/${req.params.node}`, req.params.how) ? 204 : 404)
})
// Stream Deck integration: its status (plugin connected, devices, paired keys), and the plugin's link: the decks
// stream, its paired keys, and key presses.
app.get('/api/streamdeck', (req, res) => res.json(streamdeck.status))
app.get('/api/streamdeck/events', streamdeck.listen)
app.post('/api/streamdeck/keys', (req, res) => {
  streamdeck.report(req.body)
  res.sendStatus(204)
})
app.post('/api/streamdeck/press', async (req, res) => res.json(await streamdeck.press(req.body)))
// The packed plugin to install (made by pnpm streamdeck:pack; release zips have it).
app.get('/streamdeck/com.ovrly.deck.streamDeckPlugin', (req, res) => res.download('streamdeck/com.ovrly.deck.streamDeckPlugin', (err) =>
  err && !res.headersSent && res.status(404).send('Not packed yet: run pnpm streamdeck:pack')))

// GIPHY node's picker: trending GIFs (or ?kind=sticker, clip) or search results, 24 at a time.
app.get('/api/giphy/search', (req, res) =>
  giphy.search(String(req.query.q ?? ''), Number(req.query.offset) || 0, req.query.kind, req.query.rating).then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))
// MyInstants node's picker: search results, one page (36) at a time.
app.get('/api/myinstants/search', (req, res) =>
  myinstants.search(String(req.query.q ?? '').trim(), Number(req.query.page) || 1).then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))
// Font fields' suggestions: every Google Fonts family.
app.get('/api/fonts', (req, res) => fonts.list().then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))

// Images and sounds for the Image and Sound widgets are files on disk, used where they are: "Browse files" opens the OS
// file dialog here (a browser page can't see file paths) and /file serves a path set on a node. Only image, sound and video types,
// so this can't leak other files; no SVG: opened directly, it could run scripts on Ovrly's origin.
const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|apng|mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|m4v|ogv)$/i
// "Browse files" per kind: the dialog's prompt, the macOS file types and the extensions (Windows) it allows.
const BROWSE = {
  image: ['Pick an image or GIF', ['public.png', 'public.jpeg', 'com.compuserve.gif', 'org.webmproject.webp', 'public.avif'], ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'apng']],
  sound: ['Pick a sound', ['public.mp3', 'com.microsoft.waveform-audio', 'org.xiph.ogg-audio', 'public.mpeg-4-audio', 'public.aac-audio', 'org.xiph.flac'], ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']],
  video: ['Pick a video', ['public.mpeg-4', 'com.apple.quicktime-movie', 'org.webmproject.webm'], ['mp4', 'webm', 'mov', 'm4v', 'ogv']],
}
// The OS's own file dialog, as a command that prints the picked path (nothing if cancelled).
const dialog = (prompt, types, exts) => process.platform === 'darwin'
  ? ['osascript', ['-e', `POSIX path of (choose file with prompt "${prompt}" of type {${types.map((t) => `"${t}"`).join(', ')}})`]]
  : ['powershell', ['-NoProfile', '-STA', '-Command', `
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    Add-Type -AssemblyName System.Windows.Forms
    $d = New-Object Windows.Forms.OpenFileDialog
    $d.Title = '${prompt}'
    $d.Filter = '${prompt}|${exts.map((e) => `*.${e}`).join(';')}'
    $owner = New-Object Windows.Forms.Form -Property @{ TopMost = $true } # keeps the dialog in front of the browser
    if ($d.ShowDialog($owner) -eq 'OK') { $d.FileName }`]]
app.post('/api/browse-:kind', (req, res) => {
  const [prompt, types, exts] = BROWSE[req.params.kind] ?? []
  if (!prompt) return res.sendStatus(404)
  if (process.platform !== 'darwin' && process.platform !== 'win32') return res.status(501).json({ error: `Browse files only works on macOS and Windows for now: paste the file path or a URL` })
  const [cmd, args] = dialog(prompt, types, exts)
  execFile(cmd, args, (err, out) => res.json(err || !out.trim() ? {} : { path: out.trim() })) // an error is a cancel on macOS
})
app.get('/file', (req, res) => {
  const file = String(req.query.path ?? '')
  if (!path.isAbsolute(file) || !MEDIA_EXT.test(file)) return res.status(400).end()
  res.sendFile(file, { dotfiles: 'allow' }, (err) => err && !res.headersSent && res.status(404).end())
})

// The open windows, for Key Press's "Only when focused" picker.
app.get('/api/windows', (req, res) =>
  windows.list().then((list) => res.json([...new Set(list.filter(Boolean))]), (err) => res.status(503).json({ error: err.message })))

// Widget types for the UI: metadata, and each action's description, inputs and only (no functions).
app.get('/api/widget-types', (req, res) => res.json(Object.values(widgets.types).map(({ actions, output, playTime, stopTime, on, queues, over, ...meta }) => ({
  ...meta,
  actions: Object.fromEntries(Object.entries(actions).map(([name, { run, ...action }]) => [name, action])),
}))))
// Widget instances, one per widget node (server/widgets.js): created when a widget is dropped or pasted ({ type,
// state }), saved by the editor (PUT, also to put one back on undo), and run by hand, e.g. POST /api/widgets/<id>/action
// { action: 'vote', input: { option: '1', user } }, with the inputs as typed (templates aren't filled outside a run).
// Reads go through the generic routes below: a widget's file is written before the editor hears of a change.
const fail = (res) => (err) => res.status(400).json({ error: err.message })
app.post('/api/widgets', (req, res) => widgets.create(req.body.type, req.body.state).then((w) => res.json(w), fail(res)))
app.put('/api/widgets/:id', (req, res) => widgets.save({ ...req.body, id: req.params.id }).then((w) => res.json(w), fail(res)))
app.delete('/api/widgets/:id', (req, res) => widgets.remove(req.params.id).then(() => res.sendStatus(204), fail(res)))
app.post('/api/widgets/:id/action', (req, res) => {
  widgets.update(req.params.id, req.body).then(({ state, runtime }) => res.json({ state, runtime }), fail(res))
})
// An action that changed a widget's state (e.g. TwitchPlays' mode) shows in the editor's settings: see /api/activity.
widgets.changes.on('state', (widget) => activity.emit('activity', { widget: widget.id }))

// A widget instance lives as long as its workflow node. After a workflow is saved or deleted, the widgets it referred
// to and no workflow uses anymore are deleted.
const widgetRefs = (workflow) => workflow?.nodes.filter((n) => n.data.type === 'widget').map((n) => n.data.config.widget) ?? []
async function dropUnusedWidgets(refs) {
  const used = new Set((await store.list('workflows')).flatMap(widgetRefs))
  for (const id of refs.filter((id) => id && !used.has(id))) await widgets.remove(id)
}

app.get('/api/:kind', async (req, res) => res.json(await store.list(req.params.kind)))
app.get('/api/:kind/:id', async (req, res) => {
  const item = await store.get(req.params.kind, req.params.id)
  item ? res.json(item) : res.sendStatus(404)
})
app.post('/api/:kind', async (req, res) => res.json(await store.save(req.params.kind, req.body)))
app.put('/api/:kind/:id', async (req, res) => {
  // Workflow updates are merged, so the editor's autosave keeps fields it doesn't send (e.g. enabled).
  const old = req.params.kind === 'workflows' && await store.get('workflows', req.params.id)
  const item = await store.save(req.params.kind, { ...old, ...req.body, id: req.params.id })
  if (old && req.body.enabled === false) cancel(item.id) // switched off: stop what is running
  if (old) pushMerges(item) // widgets moved on a Merge Widgets canvas
  if (old) await dropUnusedWidgets(widgetRefs(old))
  res.json(item)
})
app.delete('/api/:kind/:id', async (req, res) => {
  const old = req.params.kind === 'workflows' && await store.get('workflows', req.params.id)
  await store.remove(req.params.kind, req.params.id)
  if (old) await dropUnusedWidgets(widgetRefs(old))
  res.sendStatus(204)
})
// Store errors are bad kinds/ids; Express 5 forwards rejected promises here.
app.use('/api', (err, req, res, next) => res.status(400).json({ error: err.message }))

// Widget pages for OBS browser sources: /w/<id> serves its type's page, /w/<id>/events streams its state. An unknown
// page (a deleted widget, Merge Widgets node) is an empty one, so a browser source left with it shows nothing on stream.
const blank = (res) => res.status(404).type('html').send('<!doctype html><title>Not found</title>')
app.use('/widgets', express.static('widgets'))
// Animation and physics libraries for widget pages (anime.js, three.js, cannon-es), mapped by the pages' import maps.
app.use('/vendor/animejs', express.static('node_modules/animejs/dist/modules'))
app.use('/vendor/three', express.static('node_modules/three'))
app.use('/vendor/cannon-es', express.static('node_modules/cannon-es/dist'))
// The page reports that it finished playing an action, e.g. { run: 12 }.
app.post('/w/:id/done', (req, res) => {
  widgets.finish(req.body.run)
  res.sendStatus(204)
})
app.get('/w/:id{/:events}', async (req, res) => {
  const widget = await widgets.get(req.params.id).catch(() => null) // null for an unknown type too
  if (!widget) return req.params.events ? res.sendStatus(404) : blank(res)
  if (req.params.events === 'events') return widgets.stream(widget.id, req, res)
  res.sendFile(`widgets/${widget.type}/index.html`, { root: '.' })
})

// Merge Widgets pages: /m/<workflow>/<node> shows the widget nodes linked into that node, each in an iframe placed
// on its canvas; /m/<workflow>/<node>/events streams the placement (null while there is no such node), again whenever
// the workflow is saved. It also carries the merged widgets' own snapshots, as SSE events named by widget id, so the
// page holds one connection instead of one per widget (browsers allow only 6 per server).
// A widget not placed yet gets the same default box as in the editor (Merge.jsx): half the canvas, cascading.
function mergeView(workflow, id) {
  const node = workflow?.nodes.find((n) => n.id === id && n.data.type === 'merge')
  if (!node) return null
  const { layout = {}, order = [] } = node.data.config
  const ids = [...new Set(workflow.edges.filter((e) => e.target === id).map((e) => workflow.nodes.find((n) => n.id === e.source))
    .filter((n) => n?.data.type === 'widget').map((n) => n.data.config.widget))]
  // Items from the bottom layer up (the page stacks them in that order): see the node's order setting.
  const top = [...ids.filter((w) => !order.includes(w)).reverse(), ...order.filter((w) => ids.includes(w))]
  const items = ids.map((w, i) => ({ id: w, ...(layout[w] ?? { x: 0.03 * i, y: 0.03 * i, w: 0.5, h: 0.5 }) }))
  return { items: items.sort((a, b) => top.indexOf(b.id) - top.indexOf(a.id)) }
}
const mergeClients = {} // workflow id -> Set of { node, res, widgets: widget id -> detach }
async function pushMerge(workflow, client) {
  const view = mergeView(workflow, client.node)
  client.res.write(`data: ${JSON.stringify(view)}\n\n`)
  const ids = view?.items.map((i) => i.id) ?? []
  for (const [id, detach] of client.widgets) if (!ids.includes(id)) detach(), client.widgets.delete(id)
  for (const id of ids.filter((id) => !client.widgets.has(id))) {
    const widget = await widgets.get(id).catch(() => null)
    if (widget) client.widgets.set(id, await widgets.attach(id, { write: (msg) => client.res.write(`event: ${id}\n${msg}`) }))
  }
}
function pushMerges(workflow) {
  for (const client of mergeClients[workflow.id] ?? []) pushMerge(workflow, client)
}
app.get('/m/:workflow/:node{/:events}', async (req, res) => {
  const workflow = await store.get('workflows', req.params.workflow).catch(() => null)
  if (req.params.events === 'events') {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders()
    const client = { node: req.params.node, res, widgets: new Map() }
    const set = (mergeClients[req.params.workflow] ??= new Set()).add(client)
    req.on('close', () => {
      set.delete(client)
      for (const detach of client.widgets.values()) detach()
    })
    return pushMerge(workflow, client)
  }
  if (!mergeView(workflow, req.params.node)) return blank(res)
  res.sendFile('server/merge.html', { root: '.' })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

await twitchAuth.load()
twitch.apply((await store.get('settings', 'twitch')) ?? {})
obs.connect((await store.get('settings', 'obs')) ?? {})
giphy.connect((await store.get('settings', 'giphy')) ?? {})
hue.connect((await store.get('settings', 'hue')) ?? {})
app.listen(PORT, () => console.log(`Ovrly on http://localhost:${PORT}`))
