// Takes the docs' screenshots into docs/public/screenshots/: starts Ovrly on empty data in a temp folder, makes
// workflows from its templates through the editor, and photographs the editor and some overlays with Playwright.
// Run it with `pnpm docs:shots` (in the Playwright Docker image, so every run looks the same).
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const repo = path.resolve(import.meta.dirname, '../..')
const out = path.join(repo, 'docs/public/screenshots')
const port = 6876 // not Ovrly's own, so a running Ovrly doesn't get in the way
const url = `http://localhost:${port}`
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Ovrly reads its files and its data/ from the folder it runs in: a new one, with the code linked in.
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ovrly-shots-'))
for (const dir of ['server', 'widgets', 'dist', 'node_modules']) await fs.symlink(path.join(repo, dir), path.join(cwd, dir))
const server = spawn(process.execPath, ['--import', path.join(import.meta.dirname, 'no-keys.js'), 'server/index.js'], {
  cwd, stdio: 'inherit', env: { ...process.env, PORT: port, NODE_ENV: 'production' },
})
for (let i = 0; !(await fetch(url).then((r) => r.ok, () => false)); i++) {
  if (i === 100) throw new Error('Ovrly did not start')
  await wait(100)
}
const api = (method, route, body) => fetch(url + route, {
  method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body),
}).then((r) => (r.status === 204 ? null : r.json()))
const widget = async (name) => (await api('GET', '/api/widgets')).find((w) => w.state.name === name)

await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const shot = (name, target = page) => target.screenshot({ path: path.join(out, `${name}.png`), animations: 'disabled' })
const node = (label) => page.locator('.react-flow__node').filter({ has: page.locator('.label', { hasText: label }) })
async function fromTemplate(name) {
  await page.getByRole('button', { name: 'New workflow' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await wait(500) // the graph fits the view
}

// The editor.
await page.goto(url)
await page.getByRole('button', { name: 'New workflow' }).first().click()
await shot('new-workflow', page.getByRole('dialog'))
await page.keyboard.press('Escape')
await fromTemplate('!roll dice')
await shot('editor')
await node('Cooldown').click()
await wait(500)
await shot('node-settings')
await node('Dice').click()
await wait(1000)
await shot('widget-node')
await page.getByRole('button', { name: 'Close settings' }).click()

await fromTemplate('Death counter')
await node('Control Pad').click()
await wait(500)
await shot('control-pad')
await page.getByRole('button', { name: 'Close settings' }).click()

// Merge Widgets: a wheel and a label on one canvas, made through the API (no template has one).
const wheel = await api('POST', '/api/widgets', { type: 'lottery', state: { name: 'Wheel', options: [
  { label: 'Hydrate!', weight: 1 }, { label: 'Sing a song', weight: 1 }, { label: '10 push-ups', weight: 1 }, { label: 'Nothing', weight: 1 },
] } })
const label = await api('POST', '/api/widgets', { type: 'label', state: { name: 'Last follower' } })
await api('POST', `/api/widgets/${label.id}/action`, { action: 'start', input: { text: 'Last follower: petitbonney' } })
const step = (id, x, y, type, config) => ({ id, type: 'step', position: { x, y }, data: { type, config } })
const overlay = await api('POST', '/api/workflows', { name: 'One overlay', enabled: false, nodes: [
  step('wheel', 0, 0, 'widget', { widget: wheel.id }),
  step('label', 0, 160, 'widget', { widget: label.id }),
  step('merge', 240, 80, 'merge', { layout: { // from the canvas's center to the box's, in fractions of the canvas
    [wheel.id]: { x: 0.25, y: 0.1, w: 0.45, h: 0.75 },
    [label.id]: { x: -0.25, y: -0.35, w: 0.45, h: 0.2 },
  } }),
], edges: [{ id: 'e1', source: 'wheel', target: 'merge' }, { id: 'e2', source: 'label', target: 'merge' }] })
await page.reload()
await page.getByRole('navigation').getByText(overlay.name).click()
await wait(500)
await node('Merge Widgets').click()
await wait(1500)
await shot('merge')
await page.getByRole('button', { name: 'Close settings' }).click()

// Settings.
await page.getByRole('button', { name: 'Settings', exact: true }).click()
const settings = page.getByRole('dialog')
for (const [pane, name] of [['Twitch', 'settings-twitch'], ['OBS', 'settings-obs'], ['Stream Deck', 'settings-streamdeck'], ['LAN', 'settings-lan']]) {
  await settings.locator('button', { hasText: pane }).first().click()
  await wait(300)
  await shot(name, settings)
}
await page.keyboard.press('Escape')

// Overlays, as OBS shows them, mid-play or at their end. Each is framed over a dark backdrop standing in for the
// stream (a backdrop in the page itself would be hidden by its WebGL canvas).
await fromTemplate('Event alerts')
await fromTemplate('Chat poll')
await fromTemplate('Channel points wheel')
const overlays = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 })
async function play(name, shotName, actions, ms) {
  const { id } = await widget(name)
  await overlays.setContent(`<body style="margin: 0; background: linear-gradient(135deg, #1d2633, #33203a)">
    <iframe src="${url}/w/${id}" style="border: 0; width: 100vw; height: 100vh; display: block"></iframe>`)
  await wait(1000)
  for (const action of actions) await api('POST', `/api/widgets/${id}/action`, action)
  await wait(ms)
  await overlays.screenshot({ path: path.join(out, `${shotName}.png`) })
}
await play('Event alerts', 'overlay-alerts', [{ action: 'start', input: { text: 'petitbonney just followed!' } }], 2500)
await play('Wheel of fortune', 'overlay-wheel', [{ action: 'start' }], 7500)
await play('Chat poll', 'overlay-voting', [{ action: 'start' }, ...['ana', 'bo', 'cy', 'di', 'ed'].map((user, i) =>
  ({ action: 'vote', input: { option: i < 3 ? '1' : '2', user } }))], 1500)

await browser.close()
server.kill()
console.log(`Screenshots saved in ${path.relative(repo, out)}/`)
