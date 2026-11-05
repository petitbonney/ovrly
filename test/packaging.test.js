// What the packaged app can't ship: electron-builder always drops folders named examples, test… inside node_modules,
// whatever `files:` says, so a widget page loading one works in `pnpm dev` and 404s in the desktop app.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const DROPPED = /three\/addons\/|\/vendor\/[^'"]*\/(examples?|tests?|__tests__)\//

test('widget pages load nothing the packaged app leaves out', async () => {
  const files = (await fs.readdir('widgets', { recursive: true })).filter((f) => /\.(js|html)$/.test(f))
  for (const file of files) {
    const lines = (await fs.readFile(path.join('widgets', file), 'utf8')).split('\n')
    const code = lines.filter((l) => /\bimport\b|"\/vendor\/|"three\//.test(l) && !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    assert.deepEqual(code.filter((l) => DROPPED.test(l)), [], file)
  }
})
