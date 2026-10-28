// Helix calls over Twitch's rate limit: a 429 waits for the bucket to refill and tries again, instead of failing.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
await fs.mkdir('data/settings', { recursive: true })
await fs.writeFile('data/settings/twitch-auth.json', JSON.stringify({ id: 'twitch-auth', access: 'x', expiresAt: Date.now() + 3600_000 }))
const { load, helix } = await import('../server/integrations/twitch-auth.js')
await load()

// A Twitch with a bucket of 10 points, full again at the next second.
let points = 10
let reset = 0
globalThis.fetch = async () => {
  if (Date.now() >= reset) [points, reset] = [10, (Math.floor(Date.now() / 1000) + 1) * 1000]
  if (points-- > 0) return Response.json({ data: [{ ok: true }] })
  return Response.json({ message: 'Too Many Requests' }, { status: 429, headers: { 'Ratelimit-Reset': String(reset / 1000) } })
}

test('a burst over the rate limit waits and succeeds', async () => {
  const results = await Promise.all(Array.from({ length: 30 }, () => helix('GET', 'users')))
  assert.deepEqual(results, Array(30).fill([{ ok: true }]))
})
