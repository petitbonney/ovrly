// Custom node types: ESM files in ./data/nodes/, written like the built-in ones (server/nodes/), loaded and reloaded
// next to them by the engine. They run as the server does (like the Code node): only add files you trust. Their run()
// gets `ovrly`, the helpers below, so they never import Ovrly's own files, which may change.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { record } from './bus.js'
import { vars, saveVars } from './vars.js'
import { fill, fillJson, fillUrl, value, list } from './template.js'
import { helix, status as account } from './integrations/twitch-auth.js'
import { needStreamer } from './integrations/twitch.js'
import { request } from './integrations/obs.js'
import { httpError } from './errors.js'

export const dir = path.resolve('data', 'nodes')
const FILE = /^[\w.-]+\.m?js$/

// What run({ ovrly }) gets: template filling (as built-in nodes fill their settings), the variables, the events view,
// Twitch's API as the signed-in streamer, and OBS requests (obs-websocket's names, e.g. 'SetCurrentProgramScene').
export const ovrly = {
  fill, fillJson, fillUrl, value, list,
  vars, saveVars,
  log: (event, data) => record('custom', event, data),
  twitch: { helix, userId: () => account.userId, needStreamer },
  obs: { request },
}

// Why a file's export can't be a node type, if it can't. taken: the types already loaded.
function problem(def, taken) {
  if (!def || typeof def !== 'object') return 'No node type: the file must `export default { type, label, category, run }`'
  if (!/^[\w-]+$/.test(def.type ?? '')) return '`type` must be letters, digits, - or _'
  if (taken.has(def.type)) return `Type "${def.type}" is already taken`
  if (!def.label || typeof def.label !== 'string') return '`label` is missing'
  if (!['trigger', 'logic', 'action'].includes(def.category)) return '`category` must be trigger, logic or action'
  if (typeof def.run !== 'function') return '`run` must be a function'
}

// Imports every file of the folder, in name order: { defs, errors: [{ file, error }] }. A file is imported again once
// changed (its modified time in the URL); files it imports itself aren't, until a restart.
export async function load(taken) {
  const names = await fs.promises.readdir(dir).catch(() => [])
  const defs = []
  const errors = []
  for (const file of names.filter((n) => FILE.test(n)).sort()) {
    try {
      const at = path.join(dir, file)
      const def = (await import(`${pathToFileURL(at).href}?v=${fs.statSync(at).mtimeMs}`)).default
      const why = problem(def, taken)
      if (why) throw new Error(why)
      taken.add(def.type)
      defs.push({ group: 'Custom', config: {}, ...def, custom: file })
    } catch (err) {
      console.error(`[nodes] data/nodes/${file}: ${err.message}`)
      errors.push({ file, error: err.message })
    }
  }
  return { defs, errors }
}

// Calls onChange shortly after files in the folder change (an editor saves in several steps). unref: tests exit.
export function watch(onChange) {
  fs.mkdirSync(dir, { recursive: true })
  let timer
  fs.watch(dir, () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 300)
  }).unref()
}

// Import (Settings → Custom nodes): writes the file, replacing one of the same name.
export async function save(file, code) {
  if (!FILE.test(file ?? '')) throw httpError(400, 'A custom node is a .js file')
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(path.join(dir, file), String(code ?? ''))
}

// Opens the folder in the OS file manager (Settings → Custom nodes).
export function open() {
  fs.mkdirSync(dir, { recursive: true })
  const cmd = { darwin: 'open', win32: 'explorer' }[process.platform] ?? 'xdg-open'
  execFile(cmd, [dir], () => {}) // explorer exits with 1 even when it opened
}

export async function remove(file) {
  if (!FILE.test(file ?? '')) throw httpError(400, `Invalid file: ${file}`)
  await fs.promises.rm(path.join(dir, file), { force: true })
}
