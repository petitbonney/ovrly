// Templates: values escaped for the JSON or URL they are filled into.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const { fillJson, fillUrl } = await import('../server/template.js')

const evil = { message: 'hi", "admin": true, "x": "', n: '5', list: [1, 2], word: '1, "admin": true' }

test('fillJson escapes values inside strings', () => {
  assert.deepEqual(JSON.parse(fillJson('{"text":"say {{message}}"}', evil)), { text: `say ${evil.message}` })
  assert.deepEqual(JSON.parse(fillJson('{"a":"\\"{{n}}"}', evil)), { a: '"5' })
})

test('fillJson makes values outside strings JSON values', () => {
  assert.deepEqual(JSON.parse(fillJson('{"n": {{n}}, "list": {{list}}, "w": {{word}}, "none": {{nothing}}}', evil)),
    { n: 5, list: [1, 2], w: evil.word, none: null })
})

test('fillUrl encodes values in the path and query only', () => {
  assert.equal(fillUrl('https://{{host}}/users/{{user}}?q={{q}}', { host: 'api.example:8080', user: '../admin', q: 'a&b=c' }),
    'https://api.example:8080/users/..%2Fadmin?q=a%26b%3Dc')
  assert.equal(fillUrl('{{base}}/x/{{id}}', { base: 'http://localhost:1/api', id: 'a/b' }), 'http://localhost:1/api/x/a%2Fb')
  assert.equal(fillUrl('polls?broadcaster_id={{channelId}}', { channelId: '1&x=2' }), 'polls?broadcaster_id=1%26x%3D2')
})
