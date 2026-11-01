// Text-to-Speech: the Supertonic 3 voice model (31 languages, 10 voices, on this computer), downloaded once into data/speech/
// from Settings → Text-to-Speech, and the .wav files the Text-to-Speech node makes with it (in a worker thread, speech-worker.js).
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { Worker } from 'node:worker_threads'
import { Router } from 'express'

// sherpa-onnx's build of the model (MIT code, OpenRAIL-M weights), at a fixed revision, with each file's size.
const MODEL = 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'
const BASE = `https://huggingface.co/csukuangfj2/${MODEL}/resolve/cca5a0e6c96e1d2c720986bf7e75fcc81dee3ae4`
const FILES = {
  'duration_predictor.int8.onnx': 3700147,
  'text_encoder.int8.onnx': 36416150,
  'vector_estimator.int8.onnx': 78400833,
  'vocoder.int8.onnx': 25991073,
  'tts.json': 8253,
  'unicode_indexer.bin': 262144,
  'voice.bin': 517168,
  LICENSE: 1070,
}
const TOTAL = Object.values(FILES).reduce((a, b) => a + b)
export const SIZE = `${Math.round(TOTAL / 1e6)} MB`
// The model's language codes, and its voices in the order of its speaker ids.
export const LANGS = ['ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi']
export const VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5']
const KEEP = 24 * 3600e3 // ms a made file is kept, long enough for a queued Sound widget to play it

const dir = path.resolve('data/speech', MODEL)
const outDir = path.resolve('data/speech/out')
const has = (name) => fs.statSync(path.join(dir, name), { throwIfNoEntry: false })?.size === FILES[name]

// ready: the model is all there; progress: 0 to 1 while downloading.
export const status = { ready: Object.keys(FILES).every(has), progress: null, error: '', size: SIZE }

// Downloads the files not there yet (each to a .part file first, so a cut download is never taken for a whole one).
export async function download() {
  if (status.progress !== null) return
  Object.assign(status, { progress: 0, error: '' })
  let done = 0
  try {
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, size] of Object.entries(FILES)) {
      if (!has(name)) {
        const res = await fetch(`${BASE}/${name}`)
        if (!res.ok) throw new Error(`Hugging Face answered ${res.status} for ${name}`)
        const part = path.join(dir, `${name}.part`)
        const body = Readable.fromWeb(res.body).on('data', (chunk) => (status.progress = (done += chunk.length) / TOTAL))
        await pipeline(body, fs.createWriteStream(part))
        if (fs.statSync(part).size !== size) throw new Error(`${name} came incomplete: try again`)
        fs.renameSync(part, path.join(dir, name))
      } else done += size
    }
    status.ready = true
  } catch (err) {
    status.error = `Download failed: ${err.message}`
  }
  status.progress = null
}

// The worker, started on the first speech; it makes one at a time, in order.
let worker
const pending = new Map() // id -> { resolve, reject }
let nextId = 0
function ask(message) {
  if (!worker) {
    worker = new Worker(new URL('./speech-worker.js', import.meta.url))
    worker.on('message', ({ id, error }) => {
      const p = pending.get(id)
      if (!p) return // not an answer: `node --watch` (pnpm dev) reports the worker's imports this way too
      pending.delete(id)
      error ? p.reject(new Error(`Text-to-Speech: ${error}`)) : p.resolve()
    })
    worker.on('error', (err) => {
      for (const p of pending.values()) p.reject(err)
      pending.clear()
      worker = null
    })
  }
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, dir, ...message })
  })
}

// The path of a .wav of text said in lang (a code of LANGS) by voice (of VOICES) at speed (1: normal). The same speech
// again reuses its file; files older than KEEP are removed.
export async function say(text, { lang = 'en', voice = 'F1', speed = 1 } = {}) {
  if (!status.ready) throw new Error(`Text-to-Speech: download the voice model first (Settings → Text-to-Speech)`)
  const key = createHash('sha1').update(JSON.stringify([text, lang, voice, speed])).digest('hex').slice(0, 16)
  const file = path.join(outDir, `${key}.wav`)
  if (fs.existsSync(file)) return file
  fs.mkdirSync(outDir, { recursive: true })
  for (const name of fs.readdirSync(outDir)) {
    const old = path.join(outDir, name)
    if (Date.now() - fs.statSync(old).mtimeMs > KEEP) fs.rmSync(old, { force: true })
  }
  await ask({ text, lang, sid: Math.max(0, VOICES.indexOf(voice)), speed, file })
  return file
}

// Routes (Settings → Text-to-Speech): the model's status, and downloading it (answers at once; the status follows its progress).
export const routes = Router()
routes.get('/api/speech', (req, res) => res.json(status))
routes.post('/api/speech/download', (req, res) => {
  download()
  res.json(status)
})
