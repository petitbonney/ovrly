// Server entry: REST API over the store, plus the UI (Vite in dev, ./dist in production).
import express from 'express'
import * as store from './store.js'

const PORT = process.env.PORT || 3000
const app = express()
app.use(express.json())

app.get('/api/:kind', async (req, res) => res.json(await store.list(req.params.kind)))
app.get('/api/:kind/:id', async (req, res) => {
  const item = await store.get(req.params.kind, req.params.id)
  item ? res.json(item) : res.sendStatus(404)
})
app.post('/api/:kind', async (req, res) => res.json(await store.save(req.params.kind, req.body)))
app.put('/api/:kind/:id', async (req, res) =>
  res.json(await store.save(req.params.kind, { ...req.body, id: req.params.id })))
app.delete('/api/:kind/:id', async (req, res) => {
  await store.remove(req.params.kind, req.params.id)
  res.sendStatus(204)
})
// Store errors are bad kinds/ids; Express 5 forwards rejected promises here.
app.use('/api', (err, req, res, next) => res.status(400).json({ error: err.message }))

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.listen(PORT, () => console.log(`Ovrly on http://localhost:${PORT}`))
