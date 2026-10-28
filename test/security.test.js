// Who reaches Ovrly and what it hands out: the access middleware (hosts, other websites, the LAN key), the store's
// kinds and ids (nothing outside ./data) and /file (media files only).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { access, network, setLan } = await import('../server/access.js')
const store = await import('../server/store.js')
const files = await import('../server/files.js')

// An Express request, as much of it as access() reads.
const request = ({ host = 'localhost:6875', ip = '127.0.0.1', url = '/', method = 'GET', headers = {} }) => {
  const { pathname, searchParams } = new URL(url, 'http://ovrly')
  return { method, path: pathname, originalUrl: url, query: Object.fromEntries(searchParams), hostname: host.replace(/:\d+$/, ''),
    socket: { remoteAddress: ip }, get: (name) => ({ host, ...headers })[name.toLowerCase()] }
}
// What access() answers: { code: 'next' } when it lets the request through, else its status and what it sent.
function hit(req = {}) {
  const out = {}
  const res = {
    sendStatus: (code) => Object.assign(out, { code }),
    status(code) { out.code = code; return res },
    json: (body) => Object.assign(out, { body }),
    type: () => res,
    send: (body) => Object.assign(out, { body }),
    cookie: (name, value) => Object.assign(out, { cookie: value }),
    redirect: (location) => Object.assign(out, { code: 302, location }),
  }
  access(request(req), res, () => Object.assign(out, { code: 'next' }))
  return out
}
const lan = { ip: '192.168.1.20', host: '192.168.1.10:6875' } // another device on the network

test('with LAN off, only this computer gets in, named by an address or its name', async () => {
  await setLan(false)
  assert.equal(hit().code, 'next')
  assert.equal(hit({ host: '127.0.0.1:6875' }).code, 'next')
  assert.equal(hit({ host: '[::1]:6875', ip: '::1' }).code, 'next')
  assert.equal(hit({ host: os.hostname() }).code, 'next')
  assert.equal(hit({ host: 'evil.example' }).code, 403) // DNS rebinding
  assert.equal(hit(lan).code, 403)
})

test('a request from another website is refused, but for a link opening a page', () => {
  const cross = { 'sec-fetch-site': 'cross-site' }
  assert.equal(hit({ method: 'POST', url: '/api/workflows', headers: cross }).code, 403)
  assert.equal(hit({ headers: { ...cross, 'sec-fetch-mode': 'navigate' } }).code, 'next')
  assert.equal(hit({ url: '/api/workflows', headers: { ...cross, 'sec-fetch-mode': 'navigate' } }).code, 403)
  assert.equal(hit({ headers: { 'sec-fetch-site': 'same-origin' } }).code, 'next')
  // Older browsers only send Origin.
  assert.equal(hit({ method: 'POST', headers: { origin: 'http://evil.example' } }).code, 403)
  assert.equal(hit({ method: 'POST', headers: { origin: 'http://localhost:6875' } }).code, 'next')
})

test('with LAN on, other devices get widget pages, and the editor with its key', async () => {
  await setLan(true)
  const { key } = network()
  assert.equal(hit({ ...lan, url: '/w/abc' }).code, 'next')
  assert.equal(hit({ ...lan, url: '/hooks/go' }).code, 'next')
  assert.equal(hit({ ...lan, url: '/' }).code, 401)
  assert.match(hit({ ...lan, url: '/api/workflows' }).body.error, /Settings → Network/)
  assert.deepEqual(hit({ ...lan, url: `/?x=1&key=${key}` }), { code: 302, cookie: key, location: '/?x=1' })
  assert.equal(hit({ ...lan, url: '/?key=wrong' }).code, 401)
  assert.equal(hit({ ...lan, headers: { cookie: `a=b; ovrly-key=${key}` } }).code, 'next')
  assert.equal(hit({ ...lan, headers: { cookie: 'ovrly-key=wrong' } }).code, 401)
})

test('turning LAN on again makes a new key, which signs the other devices out', async () => {
  await setLan(true)
  const old = network().key
  await setLan(false)
  assert.equal(network().key, '')
  await setLan(true)
  assert.notEqual(network().key, old)
  assert.equal((await store.get('settings', 'network')).key, network().key)
  assert.equal(hit({ ...lan, headers: { cookie: `ovrly-key=${old}` } }).code, 401)
})

test('the store refuses kinds and ids that would leave ./data', async () => {
  await assert.rejects(store.get('widgets', '../settings/network'), { status: 400 })
  await assert.rejects(store.save('widgets', { id: '../x' }), { status: 400 })
  await assert.rejects(store.remove('widgets', 'a/b'), { status: 400 })
  await assert.rejects(store.list('..'), { status: 400 })
})

test('/file serves media files by absolute path only', () => {
  const serve = (file) => {
    const out = {}
    const res = {
      status(code) { out.code = code; return res },
      end: () => {},
      sendFile: (sent, options, done) => { out.sent = sent; done(new Error('missing')) },
    }
    files.serve({ query: { path: file } }, res)
    return out
  }
  assert.deepEqual(serve('a.png'), { code: 400 })
  assert.deepEqual(serve('/etc/passwd'), { code: 400 })
  assert.deepEqual(serve('/x/a.svg'), { code: 400 }) // could run scripts on Ovrly's origin
  assert.deepEqual(serve('/x/a.PNG'), { sent: '/x/a.PNG', code: 404 })
})
