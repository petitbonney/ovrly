// Server entry: REST API over the store, widget pages, plus the UI (Vite in dev, ./dist in production).
import express from 'express'
import * as store from './store.js'
import bus from './bus.js'
import { nodes, fire } from './engine.js'
import * as twitch from './sources/twitch.js'
import * as widgets from './widgets.js'

const PORT = process.env.PORT || 3000
const app = express()
app.use(express.json())

// Node types for the UI library (metadata only, no run function).
app.get('/api/nodes', (req, res) => res.json(Object.values(nodes).map(({ run, ...meta }) => meta)))
// Fire a fake event on the bus, e.g. POST /api/emit/chat { user, message }.
app.post('/api/emit/:event', (req, res) => {
  bus.emit(req.params.event, req.body)
  res.sendStatus(204)
})

// Runs a workflow's manual triggers now (the Run button in the editor).
app.post('/api/workflows/:id/run', async (req, res) => {
  const workflow = await store.get('workflows', req.params.id).catch(() => null)
  if (!workflow) return res.sendStatus(404)
  fire(workflow, 'manual', {})
  res.sendStatus(204)
})
// API call trigger: any request to /hooks/<path> fires the matching nodes; the query and JSON body become data.
app.all('/hooks/:path', (req, res) => {
  bus.emit('webhook', { ...req.query, ...req.body, path: req.params.path })
  res.sendStatus(204)
})

// Twitch channel setting; saving it reconnects.
app.get('/api/twitch', (req, res) => res.json(twitch.status))
app.put('/api/twitch', async (req, res) => {
  const channel = String(req.body.channel || '').trim().toLowerCase().replace(/^#/, '')
  await store.save('settings', { id: 'twitch', channel })
  await twitch.connect(channel)
  res.json(twitch.status)
})

// Widget types for the UI (metadata plus action names, no functions).
app.get('/api/widget-types', (req, res) =>
  res.json(Object.values(widgets.types).map(({ actions, ...meta }) => ({ ...meta, actions: Object.keys(actions) }))))
// Run a widget action by hand, e.g. POST /api/widgets/<id>/action { action: 'vote', value: '1', user }.
app.post('/api/widgets/:id/action', async (req, res) => {
  const widget = await store.get('widgets', req.params.id)
  widget ? res.json(widgets.update(widget, req.body).state) : res.sendStatus(404)
})

app.get('/api/:kind', async (req, res) => res.json(await store.list(req.params.kind)))
app.get('/api/:kind/:id', async (req, res) => {
  const item = await store.get(req.params.kind, req.params.id)
  item ? res.json(item) : res.sendStatus(404)
})
app.post('/api/:kind', async (req, res) => res.json(await store.save(req.params.kind, req.body)))
app.put('/api/:kind/:id', async (req, res) => {
  const item = await store.save(req.params.kind, { ...req.body, id: req.params.id })
  if (req.params.kind === 'widgets') widgets.push(item) // live config changes on the overlay
  res.json(item)
})
app.delete('/api/:kind/:id', async (req, res) => {
  await store.remove(req.params.kind, req.params.id)
  res.sendStatus(204)
})
// Store errors are bad kinds/ids; Express 5 forwards rejected promises here.
app.use('/api', (err, req, res, next) => res.status(400).json({ error: err.message }))

// Widget pages for OBS browser sources: /w/<id> serves its type's page, /w/<id>/events streams its state.
app.use('/widgets', express.static('widgets'))
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

twitch.connect((await store.get('settings', 'twitch'))?.channel || '')
app.listen(PORT, () => console.log(`Ovrly on http://localhost:${PORT}`))
