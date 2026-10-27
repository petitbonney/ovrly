// Server entry: REST API over the store, widget pages, plus the UI (Vite in dev, ./dist in production).
import express from 'express'
import { access, network, setLan } from './access.js'
import * as store from './store.js'
import bus, { recent, record } from './bus.js'
import { nodes, fire, cancel, running, activity, history, line, drop, arrived, unjoin } from './engine.js'
import * as twitch from './sources/twitch.js'
import * as twitchAuth from './sources/twitch-auth.js'
import * as obs from './obs.js'
import * as giphy from './giphy.js'
import * as hue from './hue.js'
import * as streamdeck from './streamdeck.js'
import * as myinstants from './myinstants.js'
import * as fonts from './fonts.js'
import * as files from './files.js'
import * as merge from './merge.js'
import * as widgets from './widgets.js'
import * as windows from './windows.js'
import * as workflows from './workflows.js'
import { vars, saveVars } from './vars.js'
import { fill } from './template.js'

const PORT = process.env.PORT || 6875 // OVRL on a phone keypad
const app = express()
app.use(access)
app.use(express.json())

// Node types for the UI library (metadata only, no run function).
app.get('/api/nodes', (req, res) => res.json(Object.values(nodes).map(({ run, live, control, ...meta }) => ({ ...meta, live: !!live }))))
// What a node holds now, shown in its settings (node types with `live`, e.g. a Cooldown's time left), for ?type=.
app.get('/api/nodes/:workflow/:node/live', (req, res) => {
  const def = nodes[req.query.type]
  if (!def?.live) return res.sendStatus(400)
  res.json(def.live(`${req.params.workflow}/${req.params.node}`))
})
// Acts on it from there, { type, action, key }: a Cooldown's cross (drop), a Delay's or Fan In's Force and Cancel.
app.post('/api/nodes/:workflow/:node/live', (req, res) => {
  const { type, action, key } = req.body
  res.sendStatus(nodes[type]?.control?.(`${req.params.workflow}/${req.params.node}`, action, key) ? 204 : 404)
})
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
// Wait For All nodes: the links that have delivered, and ending the wait: Force (continue now) or Cancel (stop there).
app.get('/api/joins/:workflow/:node', (req, res) => res.json(arrived(req.params.workflow, req.params.node)))
app.post('/api/joins/:workflow/:node/:end', (req, res) =>
  res.sendStatus(['force', 'cancel'].includes(req.params.end) && unjoin(req.params.workflow, req.params.node, req.params.end === 'force') ? 204 : 404))
// Developer view: the recent events (chat, API calls, manual runs…), newest first. Browsers get a live table
// (events.html), anything else the JSON; ?format=json forces JSON.
app.get('/api/events', (req, res) => {
  if (req.query.format !== 'json' && req.accepts(['json', 'html']) === 'html') return res.sendFile('server/events.html', { root: '.' })
  res.type('json').send(JSON.stringify(recent, null, 2))
})
// Run history: the recent firings with what each node got and returned, newest first; ?workflow=<id> for one workflow.
app.get('/api/runs', (req, res) => res.json(history.filter((r) => !req.query.workflow || r.workflow === req.query.workflow)))
// A test chat message, for the bolt on a chat trigger: from TestViewer, with the trigger's first command if it has one
// (then the text given, if any: a Chat !command's args), and the role and first message it asks for, so the test gets
// through.
const testChat = (config, text = '') => ({
  user: 'TestViewer', login: 'testviewer', channel: twitch.status.channel, messageId: '',
  message: config.command ? `!${config.command.split('+')[0].trim().replace(/^!/, '')} ${text}`.trim() : 'Hello from Ovrly!',
  userId: '', color: '', timestamp: Date.now(), broadcaster: config.from === 'broadcaster', mod: config.from === 'mod',
  vip: config.from === 'vip', sub: config.from === 'sub', subMonths: config.from === 'sub' ? 1 : 0, firstMessage: !!config.firstOnly,
  returning: false, emotes: [], action: false, highlighted: false, rewardId: '', replyToId: '', replyToUser: '', replyToMessage: '',
})
// Runs a workflow's manual triggers now (the Run button in the editor), or just ?node=<id> (the bolt on a trigger): a
// manual trigger, or a chat trigger, sent a test message (with the body's text after its command, and its data over
// the test message's, if any: its user filled, e.g. {{ $vars.channel }}, giving the login too, TestViewer when empty).
app.post('/api/workflows/:id/run', async (req, res) => {
  const workflow = await store.get('workflows', req.params.id).catch(() => null)
  if (!workflow) return res.sendStatus(404)
  const node = workflow.nodes.find((n) => n.id === req.query.node)
  const chat = node && [nodes[node.data.type]?.event].flat().includes('chat')
  record('http', 'manual', { workflow: workflow.id, ...(chat && { test: 'chat' }) }) // not on the bus: it targets this workflow only
  const user = fill(req.body?.data?.user ?? '', {}).trim() || 'TestViewer'
  const data = chat ? { ...testChat({ ...nodes[node.data.type].config, ...node.data.config }, req.body?.text), ...req.body?.data,
    user, login: user.toLowerCase() } : {}
  fire(workflow, chat ? 'chat' : 'manual', data, {}, req.query.node)
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
      await workflows.save({ id: workflow.id, enabled: false }) // cancels what it runs
      off.push(workflow.id)
    } else cancel(workflow.id) // already off: its manual runs
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

// Settings → Network (server/access.js): LAN on or off, its key and this computer's addresses.
app.get('/api/network', (req, res) => res.json({ ...network(), port: PORT }))
app.put('/api/network', async (req, res) => {
  await setLan(req.body.lan)
  res.json({ ...network(), port: PORT })
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
// Image, sound and video files on disk (server/files.js): the OS file dialog, and serving a path set on a node.
app.post('/api/browse-:kind', files.browse)
app.get('/file', files.serve)

// Each integration's routes (Settings panes, node pickers), in its own module.
app.use(twitch.routes, obs.routes, giphy.routes, hue.routes, streamdeck.routes, myinstants.routes, fonts.routes, windows.routes)

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

// Workflow writes (server/workflows.js): saving one stops it if switched off, moves Merge Widgets and deletes widgets
// no workflow uses anymore. Reads go through the generic routes below.
app.post('/api/workflows', async (req, res) => res.json(await workflows.save(req.body)))
app.put('/api/workflows/:id', async (req, res) => res.json(await workflows.save({ ...req.body, id: req.params.id })))
app.delete('/api/workflows/:id', async (req, res) => {
  await workflows.remove(req.params.id)
  res.sendStatus(204)
})

// Settings hold secrets (Twitch tokens, the OBS password…): each integration has its own routes above, the generic ones
// below don't serve them.
app.use('/api/settings', (req, res) => res.sendStatus(404))
app.get('/api/:kind', async (req, res) => res.json(await store.list(req.params.kind)))
app.get('/api/:kind/:id', async (req, res) => {
  const item = await store.get(req.params.kind, req.params.id)
  item ? res.json(item) : res.sendStatus(404)
})
app.post('/api/:kind', async (req, res) => res.json(await store.save(req.params.kind, req.body)))
app.put('/api/:kind/:id', async (req, res) => res.json(await store.save(req.params.kind, { ...req.body, id: req.params.id })))
app.delete('/api/:kind/:id', async (req, res) => {
  await store.remove(req.params.kind, req.params.id)
  res.sendStatus(204)
})
// Errors with a status are the request's (a bad kind or id for the store, malformed JSON); the others are the server's
// (e.g. a disk error), logged. Express 5 forwards rejected promises here.
app.use('/api', (err, req, res, next) => {
  if (!err.status) console.error('[api]', err)
  res.status(err.status ?? 500).json({ error: err.message })
})

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

// Merge Widgets pages (server/merge.js): /m/<workflow>/<node> shows the widget nodes linked into that node, on its
// canvas; /m/<workflow>/<node>/events streams their placement and snapshots.
app.get('/m/:workflow/:node{/:events}', async (req, res) => {
  const workflow = await store.get('workflows', req.params.workflow).catch(() => null)
  if (req.params.events === 'events') return merge.stream(workflow, req, res)
  if (!merge.view(workflow, req.params.node)) return blank(res)
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
