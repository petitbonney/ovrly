// JSON file storage: one file per item at ./data/<kind>/<id>.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const root = path.resolve('data')
// Restrict kinds and ids so a request can't escape ./data.
const KINDS = ['workflows', 'widgets', 'settings']
const ID = /^[\w-]+$/

function file(kind, id) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown kind: ${kind}`)
  if (id !== undefined && !ID.test(id)) throw new Error(`Invalid id: ${id}`)
  return id === undefined ? path.join(root, kind) : path.join(root, kind, `${id}.json`)
}

export async function list(kind) {
  const names = await fs.readdir(file(kind)).catch(() => [])
  const ids = names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5))
  return Promise.all(ids.map((id) => get(kind, id)))
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
    try { return await fs.rename(tmp, file(kind, saved.id)).then(() => saved) } catch (err) {
      if (tries < 5 && ['EPERM', 'EBUSY'].includes(err.code)) { await new Promise((r) => setTimeout(r, 50 * tries)); continue }
      await fs.rm(tmp, { force: true })
      throw err
    }
  }
}

export async function remove(kind, id) {
  await fs.rm(file(kind, id), { force: true })
}
