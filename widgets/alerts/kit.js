// Helpers for the alert layouts: sounds made with WebAudio (no files to ship), text split into letters, text fitted
// to its box.
import { el } from '/widgets/lib.js'

// One audio context for the page, made on the first sound, through a master gain: the volume setting (0 to 1). OBS
// plays it without a click; a browser tab may stay silent.
let audio, master, level = 1
export const setVolume = (v) => (level = v)
function ctx() {
  if (!audio) {
    audio = new AudioContext()
    master = audio.createGain()
    master.connect(audio.destination)
  }
  master.gain.value = level
  return audio
}

// A note of freq Hz (gliding to `to`) for ms, fading out; delay ms from now.
export function tone(freq, ms, { to = freq, type = 'sine', gain = 0.15, delay = 0 } = {}) {
  const a = ctx(), t = a.currentTime + delay / 1000, end = t + ms / 1000
  const osc = a.createOscillator(), env = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(to, end)
  env.gain.setValueAtTime(gain, t)
  env.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(env).connect(master)
  osc.start(t)
  osc.stop(end)
}

// A burst of noise through a band-pass filter at freq Hz (sweeping to `to`) for ms: clacks, slaps, tears, whooshes.
export function noise(ms, { freq = 1000, to = freq, q = 1, gain = 0.3, delay = 0 } = {}) {
  const a = ctx(), t = a.currentTime + delay / 1000, end = t + ms / 1000
  const buffer = a.createBuffer(1, Math.ceil((a.sampleRate * ms) / 1000), a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = Object.assign(a.createBufferSource(), { buffer })
  const filter = Object.assign(a.createBiquadFilter(), { type: 'bandpass' })
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, t)
  filter.frequency.exponentialRampToValueAtTime(to, end)
  const env = a.createGain()
  env.gain.setValueAtTime(gain, t)
  env.gain.exponentialRampToValueAtTime(0.0001, end)
  src.connect(filter).connect(env).connect(master)
  src.start(t)
}

// Fills node with one span per letter, for letter animations, and returns them. Spaces stay text, so lines still wrap
// between words, not inside them.
export function letters(node, text) {
  const spans = []
  for (const c of text) {
    if (c === ' ') {
      node.append(' ')
      continue
    }
    const span = el('span', 'ch', c)
    spans.push(span)
    node.append(span)
  }
  return spans
}

// Shrinks text's font from max px until it fits in w × h px (it must be in the page), down to min.
export function fit(text, w, h, max, min = 14) {
  let size = max
  text.style.fontSize = `${size}px`
  while (size > min && (text.offsetHeight > h || text.scrollWidth > w)) {
    text.style.fontSize = `${(size -= 2)}px`
  }
}

// From n ms of moves, the hold that fills the rest of the alert's ms, and k: the factor that shrinks the moves when
// the alert is too short for them (a third of it stays for the hold).
export function timing(ms, moves) {
  const k = Math.min(1, (ms * 2) / 3 / moves)
  return { k, hold: ms - moves * k }
}
