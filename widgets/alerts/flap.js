// Flap board layout: an airport split-flap display. Every flap flips through letters before settling on the text,
// left to right, with a clatter; at the end, they flip back to blank and the board fades.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { noise, timing } from '/widgets/alerts/kit.js'

const COLS = 16, ROWS = 3
const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?.,:-#@&'
const IN = 300, OUT = 300 // ms: the board fading in and out
const FLIP = 60 // ms per flip
const SETTLE = 400, COL = 55, ROW = 90 // ms: when the first flap settles, then each next column and row
const CLEAR = 500 // ms of flipping back to blank
const flipping = SETTLE + COLS * COL + ROWS * ROW + 80

// The text in at most ROWS lines of COLS, words kept whole when they fit, each line centered.
function rows(text) {
  const lines = []
  for (let word of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    while (word.length > COLS) {
      lines.push(word.slice(0, COLS))
      word = word.slice(COLS)
    }
    const next = lines.length ? `${lines.at(-1)} ${word}` : word
    if (lines.length && next.length <= COLS) lines[lines.length - 1] = next
    else lines.push(word)
  }
  if (lines.length > ROWS) {
    lines.length = ROWS
    lines[ROWS - 1] = `${lines[ROWS - 1].slice(0, COLS - 1)}…`
  }
  return lines.map((l) => l.padStart(Math.floor((COLS + l.length) / 2)).padEnd(COLS))
}

export default function flap(box, { text }, ms, { sound }) {
  const lines = rows(text)
  const cells = lines.flatMap((l, row) => [...l].map((target, col) => {
    const ch = el('span', '', '')
    return { node: el('div', 'flap-cell', ch), ch, target, row, col, seed: Math.floor(Math.random() * CHARS.length), jitter: Math.random() * 80 }
  }))
  const frame = el('div', 'flap-frame', ...cells.map((c) => c.node))
  box.append(frame)

  const { k, hold } = timing(ms, IN + flipping + CLEAR + OUT)
  const start = IN * k, clear = (IN + flipping) * k + hold
  // Draws every flap at t ms: blank, flipping through letters, or settled.
  function draw(t) {
    for (const c of cells) {
      const settle = start + (SETTLE + c.col * COL + c.row * ROW + c.jitter) * k
      const blank = clear + (c.col * 25 + c.jitter) * k // when it settles back to blank
      const moving = (t > start && t < settle) || (t > clear && t < blank)
      const char = moving ? CHARS[(c.seed + Math.floor(t / FLIP)) % CHARS.length] : t >= settle && t <= clear ? c.target : ' '
      if (c.ch.textContent !== char) c.ch.textContent = char
      // A flap falling: squashed, then opening up until the next one.
      c.ch.style.transform = moving ? `scaleY(${0.3 + 0.7 * ((t % FLIP) / FLIP)})` : ''
    }
  }

  const tl = createTimeline({ onUpdate: (self) => draw(self.currentTime) })
    .add(frame, { opacity: [0, 1], duration: IN * k }, 0)
    .add(frame, { opacity: 0, duration: OUT * k }, clear + CLEAR * k)
  if (sound) {
    const clack = () => noise(18, { freq: 2800 + Math.random() * 1500, q: 2, gain: 0.12 })
    for (let t = start; t < start + flipping * k; t += 45) tl.call(clack, t + 1)
    for (let t = clear; t < clear + CLEAR * k; t += 45) tl.call(clack, t + 1)
  }
  return tl
}
