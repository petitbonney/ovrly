// Neon sign layout: the text as a neon tube on a dark brick wall. Its letters flicker on one by one with a buzz, one
// of them stutters while it shows, then the whole sign sputters out.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, letters, noise, timing, tone } from '/widgets/alerts/kit.js'

const WALL = 300, OUT = 700 // ms: the wall fading in, the sign sputtering out and the wall fading
const LETTER = 70, LIGHTING = 1200 // ms per letter lighting up, at most LIGHTING for all of them
// A tube catching: on, off, on… (opacity keyframes, ms).
const CATCH = [[1, 30], [0.2, 50], [1, 30], [0.45, 40], [1, 30]]
const SPUTTER = [[0.3, 40], [0.9, 40], [0.15, 60], [0.7, 40], [0.12, 120]]
const keyframes = (steps, k) => steps.map(([to, duration]) => ({ to, duration: duration * k }))

export default function neon(box, { text }, ms, { sound }) {
  const line = el('div', 'line')
  const chars = letters(line, text)
  const wall = el('div', 'neon-wall'), halo = el('div', 'neon-halo')
  box.append(wall, halo, el('div', 'neon-text center', line))
  fit(line, 640, 240, 76, 24)

  const lighting = Math.min(LIGHTING, chars.length * LETTER)
  const { k, hold } = timing(ms, WALL + lighting + OUT)
  const lit = (WALL + lighting) * k, out = lit + hold
  const tl = createTimeline()
    .add(wall, { opacity: [0, 1], duration: WALL * k }, 0)
    .add(halo, { opacity: [0, 1], duration: lighting * k, ease: 'inQuad' }, WALL * k)
  chars.forEach((c, i) => {
    const at = (WALL + (i / chars.length) * lighting + Math.random() * 40) * k
    tl.add(c, { opacity: keyframes(CATCH, k), ease: 'linear' }, at)
    if (sound) tl.call(() => noise(30, { freq: 3000, gain: 0.05 }), at)
  })
  // One letter stutters halfway through.
  const stutter = chars[Math.floor(Math.random() * chars.length)]
  if (stutter && hold > 600) tl.add(stutter, { opacity: keyframes([[0.2, 60], [1, 40], [0.3, 80], [1, 40]], 1), ease: 'linear' }, lit + hold / 2)
  tl.add(chars, { opacity: keyframes(SPUTTER, k), ease: 'linear' }, out)
    .add(halo, { opacity: 0, duration: 300 * k }, out)
    .add(wall, { opacity: 0, duration: 300 * k }, out + 400 * k)
  if (sound) {
    tl.call(() => {
      tone(110, 450, { type: 'sawtooth', gain: 0.06 })
      tone(220, 450, { type: 'square', gain: 0.02 })
    }, lit)
    if (stutter && hold > 600) tl.call(() => noise(80, { freq: 2500, gain: 0.08 }), lit + hold / 2)
    tl.call(() => noise(300, { freq: 900, q: 0.6, gain: 0.12 }), out)
  }
  return tl
}
