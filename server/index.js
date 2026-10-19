// Server entry: REST API over the store, widget pages, plus the UI (Vite in dev, ./dist in production).
import path from 'node:path'
import { execFile } from 'node:child_process'
import express from 'express'
import * as store from './store.js'
import bus, { recent, record } from './bus.js'
import { nodes, fire, cancel, running, activity, history, line, drop } from './engine.js'
import * as twitch from './sources/twitch.js'
import * as twitchAuth from './sources/twitch-auth.js'
import * as eventsub from './sources/twitch-eventsub.js'
import * as obs from './obs.js'
import * as giphy from './giphy.js'
import * as myinstants from './myinstants.js'
import * as widgets from './widgets.js'
import * as windows from './windows.js'
import upgrade, { upgradeWidget } from './upgrade.js'

// The OBS connection used to be set in each OBS node: the first one found becomes the OBS integration's settings
// (the upgrade below then removes it from the nodes).
if (!(await store.get('settings', 'obs'))) {
  const node = (await store.list('workflows')).flatMap((w) => w.nodes ?? []).find((n) => n.data.type.startsWith('obs-') && n.data.config.url)
  await store.save('settings', { id: 'obs', url: node?.data.config.url ?? 'ws://localhost:4455', password: node?.data.config.password ?? '' })
}

// Items saved by older versions are upgraded once, before anything reads them.
const upgraded = (kind, item) => kind === 'workflows' ? upgrade(item) : kind === 'widgets' ? upgradeWidget(item, widgets.types) : item
for (const kind of ['workflows', 'widgets']) {
  for (const item of await store.list(kind)) {
    if (upgraded(kind, item) !== item) await store.save(kind, upgraded(kind, item))
  }
}

// The Image/GIF widget's image used to be a widget setting, shown when its "show" action had no value; it is now that
// value, set on the node: nodes that showed the widget's image get it (the setting is then dropped).
const images = Object.fromEntries((await store.list('widgets')).filter((w) => w.type === 'image' && 'image' in (w.config ?? {})).map((w) => [w.id, w]))
for (const workflow of Object.keys(images).length ? await store.list('workflows') : []) {
  const nodes = workflow.nodes?.map((n) => {
    const image = images[n.data.config?.widget]?.config.image
    const shows = n.data.type === 'widget' || (n.data.type === 'widget-callback' && ['', 'show'].includes(n.data.config.action ?? ''))
    return image && shows && !n.data.config.value ? { ...n, data: { ...n.data, config: { ...n.data.config, value: image } } } : n
  })
  if (nodes?.some((n, i) => n !== workflow.nodes[i])) await store.save('workflows', { ...workflow, nodes })
}
for (const { config: { image, ...config }, ...widget } of Object.values(images)) await store.save('widgets', { ...widget, config })

const PORT = process.env.PORT || 6875 // OVRL on a phone keypad
const app = express()
app.use(express.json())

// Node types for the UI library (metadata only, no run function).
app.get('/api/nodes', (req, res) => res.json(Object.values(nodes).map(({ run, ...meta }) => meta)))
// Fire a fake event on the bus, e.g. POST /api/emit/chat { user, message }.
app.post('/api/emit/:event', (req, res) => {
  bus.emit(req.params.event, req.body)
  res.sendStatus(204)
})

// Live run feedback for the workflow editor: an SSE stream of the engine's node and link activity.
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
// Runs a workflow's manual triggers now (the Run button in the editor), or just ?node=<id> (the bolt on a manual trigger).
app.post('/api/workflows/:id/run', async (req, res) => {
  const workflow = await store.get('workflows', req.params.id).catch(() => null)
  if (!workflow) return res.sendStatus(404)
  record('http', 'manual', { workflow: workflow.id }) // not on the bus: it targets this workflow only
  fire(workflow, 'manual', {}, {}, req.query.node)
  res.sendStatus(204)
})
// Emergency stop: switches every workflow off and cancels what is running.
app.post('/api/stop', async (req, res) => {
  for (const workflow of await store.list('workflows')) {
    if (workflow.enabled !== false) await store.save('workflows', { ...workflow, enabled: false })
    cancel(workflow.id)
  }
  record('http', 'stop-all', {})
  res.sendStatus(204)
})
// API call trigger: any request to /hooks/<path> fires the matching nodes; the query and JSON body become data.
app.all('/hooks/:path', (req, res) => {
  bus.emit('webhook', { ...req.query, ...req.body, path: req.params.path })
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
// GIPHY node's picker: trending GIFs or search results, 24 at a time.
app.get('/api/giphy/search', (req, res) =>
  giphy.search(String(req.query.q ?? ''), Number(req.query.offset) || 0).then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))
// MyInstants node's picker: search results, one page (36) at a time.
app.get('/api/myinstants/search', (req, res) =>
  myinstants.search(String(req.query.q ?? '').trim(), Number(req.query.page) || 1).then((list) => res.json(list), (err) => res.status(503).json({ error: err.message })))

// Images and sounds for the Image and Sound widgets are files on disk, used where they are: "Browse files" opens the OS
// file dialog here (a browser page can't see file paths) and /file serves a path set on a node. Only image, sound and video types,
// so this can't leak other files; no SVG: opened directly, it could run scripts on Ovrly's origin. /media serves images
// uploaded by older versions.
const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|apng|mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|m4v|ogv)$/i
app.use('/media', express.static('data/media'))
// "Browse files" per kind: the dialog's prompt and the file types it allows.
const BROWSE = {
  image: ['Pick an image or GIF', ['public.png', 'public.jpeg', 'com.compuserve.gif', 'org.webmproject.webp', 'public.avif']],
  sound: ['Pick a sound', ['public.mp3', 'com.microsoft.waveform-audio', 'org.xiph.ogg-audio', 'public.mpeg-4-audio', 'public.aac-audio', 'org.xiph.flac']],
  video: ['Pick a video', ['public.mpeg-4', 'com.apple.quicktime-movie', 'org.webmproject.webm']],
}
app.post('/api/browse-:kind', (req, res) => {
  const [prompt, types] = BROWSE[req.params.kind] ?? []
  if (!prompt) return res.sendStatus(404)
  if (process.platform !== 'darwin') return res.status(501).json({ error: `Browse files only works on macOS for now: paste the file path or a URL` })
  const script = `POSIX path of (choose file with prompt "${prompt}" of type {${types.map((t) => `"${t}"`).join(', ')}})`
  execFile('osascript', ['-e', script], (err, out) => {
    if (err) return res.json({}) // cancelled
    res.json({ path: out.trim() })
  })
})
app.get('/file', (req, res) => {
  const file = String(req.query.path ?? '')
  if (!path.isAbsolute(file) || !MEDIA_EXT.test(file)) return res.status(400).end()
  res.sendFile(file, { dotfiles: 'allow' }, (err) => err && !res.headersSent && res.status(404).end())
})

// The open windows, for Key Press's "Only when focused" picker.
app.get('/api/windows', (req, res) =>
  windows.list().then((list) => res.json([...new Set(list.filter(Boolean))]), (err) => res.status(503).json({ error: err.message })))

// Widget types for the UI (metadata plus action names, no functions).
app.get('/api/widget-types', (req, res) =>
  res.json(Object.values(widgets.types).map(({ actions, output, playTime, fades, on, ...meta }) => ({ ...meta, actions: Object.keys(actions) }))))
// Run a widget action by hand, e.g. POST /api/widgets/<id>/action { action: 'vote', value: '1', user }.
app.post('/api/widgets/:id/action', async (req, res) => {
  const widget = await store.get('widgets', req.params.id)
  if (!widget) return res.sendStatus(404)
  widgets.update(widget, req.body).then(({ state }) => res.json(state), (err) => res.status(400).json({ error: err.message }))
})

// A widget instance lives as long as a workflow node refers to it (pasted nodes can share one across workflows).
// After a workflow is saved or deleted, the widgets it referred to and no workflow uses anymore are deleted.
const widgetRefs = (workflow) => workflow?.nodes.filter((n) => n.data.type === 'widget').map((n) => n.data.config.widget) ?? []
async function dropUnusedWidgets(refs) {
  const used = new Set((await store.list('workflows')).flatMap(widgetRefs))
  for (const w of await store.list('widgets')) {
    const referred = refs.includes(w.id) || refs.includes(w.name)
    if (referred && !used.has(w.id) && !used.has(w.name)) await store.remove('widgets', w.id)
  }
}

app.get('/api/:kind', async (req, res) => res.json(await store.list(req.params.kind)))
app.get('/api/:kind/:id', async (req, res) => {
  const item = await store.get(req.params.kind, req.params.id)
  item ? res.json(item) : res.sendStatus(404)
})
app.post('/api/:kind', async (req, res) => res.json(await store.save(req.params.kind, upgraded(req.params.kind, req.body))))
app.put('/api/:kind/:id', async (req, res) => {
  // Workflow updates are merged, so the editor's autosave keeps fields it doesn't send (e.g. enabled).
  const old = req.params.kind === 'workflows' && await store.get('workflows', req.params.id)
  const item = await store.save(req.params.kind, upgraded(req.params.kind, { ...old, ...req.body, id: req.params.id }))
  if (old && req.body.enabled === false) cancel(item.id) // switched off: stop what is running
  if (req.params.kind === 'widgets') widgets.push(item) // live config changes on the overlay
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

// Widget pages for OBS browser sources: /w/<id> serves its type's page, /w/<id>/events streams its state.
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
  const widget = await store.get('widgets', req.params.id).catch(() => null)
  if (!widget || !widgets.types[widget.type]) return res.sendStatus(404)
  if (req.params.events === 'events') return widgets.stream(widget, req, res)
  res.sendFile(`widgets/${widget.type}/index.html`, { root: '.' })
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
app.listen(PORT, () => console.log(`Ovrly on http://localhost:${PORT}`))
