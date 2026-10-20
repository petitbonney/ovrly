// Speech bubble layout: a comic bubble pops in with a squash and stretch over a burst, its text typed in letter by
// letter, then both pop away.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, letters, noise, timing, tone } from '/widgets/alerts/kit.js'

const POP = 400, OUT = 300 // ms
const TYPE = 35, TYPING = 900 // ms per letter, at most TYPING for all of them

// The bubble (600 × 300) and its tail as one outline: both shapes drawn thick in black, then in white on top.
const shapes = '<rect x="12" y="12" width="576" height="228" rx="70"/><path d="M150 220 L105 292 L245 230 Z"/>'
const BUBBLE = `<svg viewBox="0 0 600 300"><g stroke="#111" stroke-width="14" stroke-linejoin="round">${shapes}</g><g fill="#fff">${shapes}</g></svg>`

// A star of `points` spikes in a w × h box, as an SVG polygon.
function burst(w, h, points) {
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const a = (i / (points * 2)) * 2 * Math.PI, r = i % 2 ? 0.74 : 1
    return `${w / 2 + Math.cos(a) * r * (w / 2 - 6)},${h / 2 + Math.sin(a) * r * (h / 2 - 6)}`
  })
  return `<svg viewBox="0 0 ${w} ${h}"><polygon points="${corners.join(' ')}" fill="var(--c)" stroke="#111" stroke-width="6" stroke-linejoin="round"/></svg>`
}

export default function bubble(box, { text }, ms, { sound }) {
  const line = el('div', 'line')
  const chars = letters(line, text)
  const star = el('div', 'bubble-burst')
  star.innerHTML = burst(640, 460, 16)
  const shape = el('div', 'bubble-shape')
  shape.innerHTML = BUBBLE
  shape.append(el('div', 'bubble-text center', line))
  box.append(star, shape)
  fit(line, 500, 190, 56, 18)

  const per = Math.min(TYPE, TYPING / Math.max(chars.length, 1))
  const typing = per * chars.length
  const { k, hold } = timing(ms, POP + typing + OUT)
  const out = (POP + typing) * k + hold
  const tl = createTimeline()
    .add(star, { scale: [0, 1], duration: POP * k, ease: 'outBack(2)' }, 0)
    .add(star, { rotate: [-6, 6], duration: ms, ease: 'linear' }, 0)
    .add(shape, {
      scaleX: [{ from: 0.2, to: 1.15, duration: 160 * k }, { to: 0.95, duration: 120 * k }, { to: 1, duration: 120 * k }],
      scaleY: [{ from: 0.2, to: 0.85, duration: 160 * k }, { to: 1.08, duration: 120 * k }, { to: 1, duration: 120 * k }],
      ease: 'outQuad',
    }, 0)
  chars.forEach((c, i) => {
    tl.add(c, { opacity: [0, 1], duration: 1 }, (POP + i * per) * k)
    if (sound && i % 2 === 0) tl.call(() => tone(1100 + Math.random() * 500, 25, { type: 'square', gain: 0.025 }), (POP + i * per) * k)
  })
  tl.add([shape, star], { scale: 0, duration: OUT * k, ease: 'inBack(2)' }, out)
  if (sound) {
    tl.call(() => {
      tone(300, 140, { to: 900, gain: 0.25 })
      noise(60, { freq: 1500, gain: 0.1 })
    }, 1)
    tl.call(() => tone(700, 140, { to: 250, gain: 0.2 }), out)
  }
  return tl
}
