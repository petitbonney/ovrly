// Arcade layout: a CRT switches on, the text types in like a high score entry, blinks three times with a jingle, a
// "+1 UP" floats away with a coin sound, then the screen switches off. Drawn in real pixels: the text goes on a small
// canvas (each pixel fully on or off) shown four times bigger.
import { createTimeline } from 'animejs'
import { timing, tone } from '/widgets/alerts/kit.js'

const W = 160, H = 90 // canvas px; the screen is 640 × 360
const ON = 400, OFF = 400, BLINK = 900, UP = 800 // ms
const TYPE = 60, TYPING = 1200 // ms per letter, at most TYPING for all of them
const FONT = (size) => `700 ${size}px ui-monospace, Menlo, Consolas, monospace`

// The text in lines that fit the screen, at the biggest size that fits: { lines, size }.
function wrap(ctx, text) {
  for (const size of [16, 13, 11, 9, 8]) {
    ctx.font = FONT(size)
    const lines = []
    for (const word of text.toUpperCase().split(/\s+/).filter(Boolean)) {
      const next = lines.length ? `${lines.at(-1)} ${word}` : word
      if (lines.length && ctx.measureText(next).width <= W - 12) lines[lines.length - 1] = next
      else lines.push(word)
    }
    if (lines.length * (size + 3) <= H - 30 && lines.every((l) => ctx.measureText(l).width <= W - 12)) return { lines, size }
    if (size === 8) return { lines: lines.slice(0, Math.floor((H - 30) / 11)), size }
  }
}

export default function arcade(box, { text }, ms, { color, sound }) {
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const crt = document.createElement('div')
  crt.className = 'arcade-crt'
  crt.append(canvas)
  box.append(crt)
  const ctx = canvas.getContext('2d')
  const { lines, size } = wrap(ctx, text)
  const total = lines.join('').length

  const per = Math.min(TYPE, TYPING / Math.max(total, 1))
  const { k, hold } = timing(ms, ON + per * total + BLINK + OFF)
  const typed = (ON + per * total) * k, off = typed + hold + BLINK * k

  // Draws the screen at t ms: the header, the letters typed so far and a cursor, blinks, the "+1 UP".
  function draw(t) {
    ctx.clearRect(0, 0, W, H)
    ctx.textBaseline = 'top'
    ctx.font = FONT(8)
    ctx.fillStyle = '#fff'
    ctx.fillText('HIGH SCORE', (W - ctx.measureText('HIGH SCORE').width) / 2, 6)
    const blink = t > typed && t < typed + BLINK * k && Math.floor((t - typed) / (150 * k)) % 2 === 0
    if (!blink) {
      ctx.font = FONT(size)
      ctx.fillStyle = color
      let left = Math.floor((t - ON * k) / (per * k))
      const top = 22 + (H - 26 - lines.length * (size + 3)) / 2
      lines.forEach((l, i) => {
        const x = (W - ctx.measureText(l).width) / 2, y = top + i * (size + 3)
        const part = l.slice(0, Math.max(left, 0))
        ctx.fillText(part, x, y)
        if (left >= 0 && left < l.length && Math.floor(t / 150) % 2) ctx.fillRect(x + ctx.measureText(part).width, y, size * 0.6, size)
        left -= l.length
      })
    }
    const up = (t - typed - BLINK * k * 0.4) / (UP * k)
    if (up > 0 && up < 1) {
      ctx.font = FONT(8)
      ctx.fillStyle = '#fff'
      if (up < 0.7 || Math.floor(t / 60) % 2) ctx.fillText('+1 UP', W - 40, 20 - up * 14)
    }
    // Every pixel fully on or off: no smoothing, like the real thing.
    const img = ctx.getImageData(0, 0, W, H)
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0
    ctx.putImageData(img, 0, 0)
  }

  const tl = createTimeline({ onUpdate: (self) => draw(self.currentTime) })
    // Switching on: a line across, then the picture. Off: the reverse.
    .add(crt, { scaleX: [0, 1], duration: (ON / 2) * k, ease: 'outQuad' }, 0)
    .add(crt, { scaleY: [0.02, 1], duration: (ON / 2) * k, ease: 'outQuad' }, (ON / 2) * k)
    .add(crt, { scaleY: 0.02, duration: (OFF / 2) * k, ease: 'inQuad' }, off)
    .add(crt, { scaleX: 0, duration: (OFF / 2) * k, ease: 'inQuad' }, off + (OFF / 2) * k)
  if (sound) {
    for (let i = 0; i < total; i++) tl.call(() => tone(i % 2 ? 990 : 880, 40, { type: 'square', gain: 0.04 }), (ON + i * per) * k + 1)
    tl.call(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 300 : 90, { type: 'square', gain: 0.05, delay: i * 90 })), typed + 1)
    tl.call(() => {
      tone(988, 80, { type: 'square', gain: 0.05 })
      tone(1319, 350, { type: 'square', gain: 0.05, delay: 80 })
    }, typed + BLINK * k * 0.4)
  }
  return tl
}
