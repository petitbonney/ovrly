// JSON file storage: one file per item at ./data/<kind>/<id>.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const root = path.resolve('data')
// Restrict kinds and ids so a request can't escape ./data.
const KINDS = ['workflows', 'widgets', 'settings']
const ID = /^[\w-]+$/
const bad = new Set() // files list() reported unreadable, so the schedule tick doesn't log them every second

function file(kind, id) {
  // status 400: the request named them (the API answers other errors with 500).
  if (!KINDS.includes(kind)) throw Object.assign(new Error(`Unknown kind: ${kind}`), { status: 400 })
  if (id !== undefined && !ID.test(id)) throw Object.assign(new Error(`Invalid id: ${id}`), { status: 400 })
  return id === undefined ? path.join(root, kind) : path.join(root, kind, `${id}.json`)
}

// Each kind's list is read from disk once, then kept until something of that kind is saved or removed: the engine
// lists workflows on every event and every second. Items are shared, so callers must not change them. Files edited by
// hand while Ovrly runs show once something of their kind is saved, or after a restart.
const lists = {} // kind -> promise of its items
export async function list(kind) {
  file(kind) // an unknown kind throws before anything is kept
  return (lists[kind] ??= readAll(kind))
}

async function readAll(kind) {
  const names = await fs.readdir(file(kind)).catch(() => [])
  const ids = names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5))
  // A file that can't be read or parsed (e.g. edited by hand) is skipped, so it can't take the others down with it.
  const items = await Promise.all(ids.map((id) => get(kind, id).catch((err) => {
    if (!bad.has(`${kind}/${id}`)) console.error(`[store] Skipping data/${kind}/${id}.json: ${err.message}`)
    bad.add(`${kind}/${id}`)
  })))
  return items.filter(Boolean)
}

export async function get(kind, id) {
  const text = await fs.readFile(file(kind, id), 'utf8').catch(() => null)
  return text && JSON.parse(text)
}

export async function save(kind, item) {
  const saved = { ...item, id: item.id || randomUUID() }
  await fs.mkdir(file(kind), { recursive: true })
  // Write aside, then rename: a crash can't leave half a file. Windows can refuse the rename while antivirus
  // or another reader holds the file, so retry briefly.
  const tmp = `${file(kind, saved.id)}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(saved, null, 2))
  for (let tries = 1; ; tries++) {
    try {
      await fs.rename(tmp, file(kind, saved.id))
      delete lists[kind] // once the file is in place: a list read meanwhile would keep the old one
      return saved
    } catch (err) {
      if (tries < 5 && ['EPERM', 'EBUSY'].includes(err.code)) { await new Promise((r) => setTimeout(r, 50 * tries)); continue }
      await fs.rm(tmp, { force: true })
      throw err
    }
  }
}

export async function remove(kind, id) {
  await fs.rm(file(kind, id), { force: true })
  delete lists[kind]
}
