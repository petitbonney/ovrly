// Text-to-Speech node without its voice model: the languages and voices it offers, and the errors it gives before speaking.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.chdir(await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-')))
const speech = (await import('../server/nodes/speech.js')).default
const run = (config, data = {}) => speech.run({ config: { ...speech.config, ...config }, data })

test('Text-to-Speech offers its languages by name and its voices', () => {
  assert.ok(speech.fields.lang.options.some((o) => o.value === 'fr' && o.label === 'French'))
  assert.deepEqual(speech.fields.voice.options.map((o) => o.label).slice(0, 2), ['Female 1', 'Female 2'])
})

test('Text-to-Speech asks for the voice model, or a text, before speaking', async () => {
  await assert.rejects(run({ text: 'Bonjour {{user}}' }, { user: 'Ana' }), /Settings → Text-to-Speech/)
  await assert.rejects(run({ text: '  {{message}} ' }), /text is empty/)
})
