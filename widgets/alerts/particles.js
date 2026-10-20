// Particles layout: a swarm of glowing dots rushes in and the letters gather out of it, then everything bursts apart.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, letters, noise, timing, tone } from '/widgets/alerts/kit.js'

const GATHER = 900, STAGGER = 600, BURST = 700 // ms: each letter flying in, all of them starting, the burst
const DOTS = 36
const spread = (r) => (Math.random() - 0.5) * 2 * r

export default function particles(box, { text }, ms, { sound }) {
  const line = el('div', 'line')
  const chars = letters(line, text)
  const dots = Array.from({ length: DOTS }, () => el('div', 'particles-dot'))
  box.append(...dots, el('div', 'particles-text center', line))
  fit(line, 680, 300, 72, 20)

  const per = Math.min(30, STAGGER / Math.max(chars.length, 1))
  const { k, hold } = timing(ms, GATHER + per * chars.length + BURST)
  const burst = (GATHER + per * chars.length) * k + hold
  const tl = createTimeline()
  // The dots rush in from all over and swirl into the text, fading as the letters form.
  for (const dot of dots) {
    tl.add(dot, {
      x: [spread(450), spread(260)], y: [spread(260), spread(60)], opacity: [{ from: 0, to: 1, duration: 300 * k }, { to: 0, duration: 900 * k }],
      scale: [1.5, 0.5], duration: 1200 * k, ease: 'outCubic',
    }, Math.random() * 200 * k)
  }
  chars.forEach((c, i) => {
    tl.add(c, { x: [spread(500), 0], y: [spread(300), 0], scale: [0, 1], rotate: [spread(180), 0], opacity: [0, 1], duration: GATHER * k, ease: 'outExpo' }, i * per * k)
  })
  // The burst: letters and dots flung out from the middle.
  tl.add(chars, { x: () => spread(600), y: () => spread(350), scale: 0, rotate: () => spread(360), opacity: 0, duration: BURST * k, ease: 'outCubic' }, burst)
  for (const dot of dots) {
    tl.add(dot, { x: [0, spread(500)], y: [0, spread(300)], opacity: [1, 0], scale: [1, 0.3], duration: BURST * k, ease: 'outCubic' }, burst)
  }
  if (sound) {
    tl.call(() => noise(900, { freq: 300, to: 3000, q: 0.8, gain: 0.2 }), 1)
    tl.call(() => [2093, 2637, 3136].forEach((f, i) => tone(f, 400, { gain: 0.04, delay: i * 70 })), GATHER * 0.7 * k)
    tl.call(() => {
      noise(500, { freq: 2000, to: 200, gain: 0.35 })
      tone(80, 400, { to: 40, gain: 0.3 })
    }, burst)
  }
  return tl
}
