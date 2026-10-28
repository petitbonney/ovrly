// Custom node and widget types: the user's own, in ./data/custom/nodes/<name>.js and ./data/custom/widgets/<type>/
// (widget.js, index.html and the files the page uses), written like the built-in ones (server/nodes/, widgets/) and
// loaded next to them (engine.js, widgets.js). They run as the server does (like the Code node): only add files you
// trust. Their functions get `ovrly`, the helpers below, so they never import Ovrly's own files, which may change.
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

export const dirs = { nodes: path.resolve('data', 'custom', 'nodes'), widgets: path.resolve('data', 'custom', 'widgets') }
// A widget folder being imported lands here first, then replaces the old one at once (and isn't watched meanwhile).
const incoming = path.resolve('data', 'custom', '.incoming')
const SCRIPT = /^[\w.-]+\.m?js$/
const TYPE = /^[\w-]+$/
// What a widget folder may hold: its page and code, and what the page shows or plays.
const ASSET = /\.(html|m?js|css|json|txt|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|otf|mp3|wav|ogg|m4a|aac|flac|mp4|webm)$/i

// What run({ ovrly }) gets (widget actions too): template filling (as built-in nodes fill their settings), the
// variables, the events view, Twitch's API as the signed-in streamer, and OBS requests (obs-websocket's names, e.g.
// 'SetCurrentProgramScene').
export const ovrly = {
  fill, fillJson, fillUrl, value, list,
  vars, saveVars,
  log: (event, data) => record('custom', event, data),
  twitch: { helix, userId: () => account.userId, needStreamer },
  obs: { request },
}

// A module's default export, imported again once the file changed (its modified time in the URL); the files it
// imports itself aren't, until a restart.
const fresh = async (file) => (await import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`)).default

// Why a file's export can't be a node or widget type, if it can't. taken: the types already loaded.
function problem(def, taken) {
  if (!TYPE.test(def.type ?? '')) return '`type` must be letters, digits, - or _'
  if (taken.has(def.type)) return `Type "${def.type}" is already taken`
  if (!def.label || typeof def.label !== 'string') return '`label` is missing'
}

// Imports each item of a folder, in name order, with load(name) → its export, and check(def, name) → why it can't
// be used, if it can't: { defs: [{ ...def, custom: name }], errors: [{ name, error }] }.
async function loadAll(kind, names, taken, load, check) {
  const defs = []
  const errors = []
  for (const name of names.sort()) {
    try {
      const def = await load(name)
      const why = !def || typeof def !== 'object' ? 'No type: the file must `export default { type, label, … }`'
        : check(def, name) ?? problem(def, taken)
      if (why) throw new Error(why)
      taken.add(def.type)
      defs.push({ ...def, custom: name })
    } catch (err) {
      console.error(`[custom] data/custom/${kind}/${name}: ${err.message}`)
      errors.push({ name, error: err.message })
    }
  }
  return { defs, errors }
}

// Node types: one file each, a trigger, logic or action with a run function.
export async function loadNodes(taken) {
  const names = (await fs.promises.readdir(dirs.nodes).catch(() => [])).filter((n) => SCRIPT.test(n))
  const { defs, errors } = await loadAll('nodes', names, taken, (name) => fresh(path.join(dirs.nodes, name)), (def) =>
    !['trigger', 'logic', 'action'].includes(def.category) ? '`category` must be trigger, logic or action'
      : typeof def.run !== 'function' ? '`run` must be a function' : undefined)
  return { defs: defs.map((def) => ({ group: 'Custom', config: {}, ...def })), errors }
}

// Widget types: one folder each, named as the type, with widget.js (a start action at least) and index.html. Their
// pages are served at /widgets/<type>/, as the built-in ones.
export async function loadWidgets(taken) {
  const entries = await fs.promises.readdir(dirs.widgets, { withFileTypes: true }).catch(() => [])
  const names = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
  const page = (name) => path.join(dirs.widgets, name, 'index.html')
  const { defs, errors } = await loadAll('widgets', names, taken, (name) => {
    const file = path.join(dirs.widgets, name, 'widget.js')
    if (!fs.existsSync(file)) throw new Error('widget.js is missing')
    return fresh(file)
  }, (def, name) => def.type !== name ? `\`type\` must be the folder's name, "${name}"`
    : !def.actions?.[def.onStart ?? 'start'] ? '`actions` must have a start action'
    : !fs.existsSync(page(name)) ? 'index.html is missing' : undefined)
  return { defs: defs.map((def) => ({ ...def, page: page(def.custom) })), errors }
}

// Calls onChange shortly after files of that kind change (an editor saves in several steps). unref: tests exit.
export function watch(kind, onChange) {
  fs.mkdirSync(dirs[kind], { recursive: true })
  let timer
  fs.watch(dirs[kind], { recursive: true }, () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 300)
  }).unref()
}

// Opens the folder in the OS file manager (Settings → Custom nodes, Custom widgets).
export function open(kind) {
  fs.mkdirSync(dirs[kind], { recursive: true })
  const cmd = { darwin: 'open', win32: 'explorer' }[process.platform] ?? 'xdg-open'
  execFile(cmd, [dirs[kind]], () => {}) // explorer exits with 1 even when it opened
}

// Deletes a node file or a widget folder.
export async function remove(kind, name) {
  if (!(kind === 'nodes' ? SCRIPT : TYPE).test(name ?? '')) throw httpError(400, `Invalid name: ${name}`)
  await fs.promises.rm(path.join(dirs[kind], name), { recursive: true, force: true })
}

// Import of a node: writes the file, replacing one of the same name.
export async function saveNode(name, code) {
  if (!SCRIPT.test(name ?? '')) throw httpError(400, 'A custom node is a .js file')
  await fs.promises.mkdir(dirs.nodes, { recursive: true })
  await fs.promises.writeFile(path.join(dirs.nodes, name), String(code ?? ''))
}

// Import of a widget folder, a file at a time (pages can hold large media): file(type, 'img/a.png', data) puts one
// aside, first clearing what an earlier import left there; done(type) then replaces the widget's folder with them.
export async function file(type, rel, data, first) {
  const parts = String(rel ?? '').split('/')
  if (!TYPE.test(type ?? '')) throw httpError(400, 'A widget folder is named as its type: letters, digits, - or _')
  if (!parts.every((p) => /^[\w][\w .-]*$/.test(p)) || !ASSET.test(rel)) throw httpError(400, `Can't import ${rel}: not a page, script, style, image, font, sound or video`)
  const at = path.join(incoming, type, ...parts)
  if (first) await fs.promises.rm(path.join(incoming, type), { recursive: true, force: true })
  await fs.promises.mkdir(path.dirname(at), { recursive: true })
  await fs.promises.writeFile(at, data)
}
export async function done(type) {
  if (!TYPE.test(type ?? '')) throw httpError(400, `Invalid type: ${type}`)
  const from = path.join(incoming, type)
  if (!fs.existsSync(path.join(from, 'widget.js'))) throw httpError(400, 'Not a widget folder: widget.js is missing')
  await fs.promises.mkdir(dirs.widgets, { recursive: true })
  await fs.promises.rm(path.join(dirs.widgets, type), { recursive: true, force: true })
  await fs.promises.rename(from, path.join(dirs.widgets, type))
}

// New widget: a working folder to start from, named after the label (e.g. "Big Text" → big-text).
export async function scaffold(label) {
  label = String(label ?? '').trim()
  const type = label.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')
  if (!type) throw httpError(400, 'Give the widget a name')
  const folder = path.join(dirs.widgets, type)
  if (fs.existsSync(folder)) throw httpError(409, `A custom widget "${type}" already exists`)
  await fs.promises.mkdir(folder, { recursive: true })
  const name = JSON.stringify(label)
  await fs.promises.writeFile(path.join(folder, 'widget.js'), STARTER.widget(type, name))
  await fs.promises.writeFile(path.join(folder, 'index.html'), STARTER.page(type, name))
  return type
}

const STARTER = {
  widget: (type, name) => `// ${name.slice(1, -1)}: shows a text for a few seconds. Made with New widget (Settings → Custom widgets): change it at
// will, it reloads on save (and so do its pages in OBS). See widgets/ in Ovrly's code for more.
export const FADE = 300 // ms: the text fading in, and out

export default {
  type: '${type}',
  label: ${name},
  icon: 'sparkles',
  description: 'Shows a text for a few seconds.',
  // Settings, saved with each widget node: the form shows one field per key.
  state: { duration: 3, color: '#ffffff', size: 64 },
  fields: {
    duration: { unit: 's', presets: [2, 3, 5, 8] },
    color: {},
    size: { unit: 'px', presets: [32, 48, 64, 96] },
  },
  // In memory only: what the page shows now.
  runtime: { text: '', at: 0 },
  // How long an action plays (ms): the workflow goes on after it. Without playTime, the page says when it's done.
  playTime: (action, { state }) => state.duration * 1000 + 2 * FADE,
  stopTime: () => FADE,
  actions: {
    start: {
      description: 'Shows the text for the set duration; the workflow goes on once it has gone.',
      inputs: { text: { vars: true, default: 'Hello {{user}}!' } },
      // ovrly has Ovrly's helpers (fill, vars, log, twitch.helix, obs.request…), e.g. ovrly.log('${type}', input).
      run: ({ input, ovrly }) => ({ runtime: { text: input.text, at: Date.now() } }),
    },
    stop: { description: 'The text fades out now; the workflow goes on.' },
    cancel: { description: 'The text disappears at once; the workflow stops there.' },
  },
}
`,
  page: (type, name) => `<!doctype html>
<meta charset="utf-8">
<title>${name.slice(1, -1).replace(/[<&]/g, '')}</title>
<link rel="stylesheet" href="/widgets/base.css">
<script type="importmap">{ "imports": { "animejs": "/vendor/animejs/index.js" } }</script>
<style>
  #page { position: fixed; inset: 0; display: grid; place-items: center; }
  #text { opacity: 0; text-align: center; }
</style>
<div id="page"><div id="text"></div></div>
<script type="module">
  import { animate } from 'animejs'
  import { subscribe, wait } from '/widgets/lib.js'
  import { FADE } from '/widgets/${type}/widget.js'
  const text = document.getElementById('text')
  let timer, anim
  const fade = (out) => {
    anim?.pause()
    anim = animate(text, { opacity: out ? 0 : [0, 1], duration: FADE, ease: out ? 'inQuad' : 'outQuad' })
  }
  // Stop: the text fades out now; cancel: it disappears at once.
  const end = (out) => {
    clearTimeout(timer)
    if (out) return fade(true)
    anim?.pause()
    text.style.opacity = 0
  }
  // Called now and on every update: { state, runtime }. A page opened after the text went shows nothing.
  subscribe(({ state, runtime }) => {
    clearTimeout(timer)
    text.style.color = state.color
    text.style.fontSize = \`\${state.size}px\`
    const left = runtime.at + state.duration * 1000 - Date.now()
    if (runtime.ended || !runtime.text || left <= 0) return void (text.style.opacity = 0)
    text.textContent = runtime.text // text, never HTML: it may come from chat
    fade(false)
    timer = setTimeout(() => fade(true), left)
    return wait(left + FADE)
  }, { stop: () => end(true), cancel: () => end(false) })
</script>
`,
}
