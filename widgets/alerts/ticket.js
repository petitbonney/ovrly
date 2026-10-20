// Ticket layout: a ticket prints out of a slot, line by line, then is torn off and drops away.
import { createTimeline, steps } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, noise, timing } from '/widgets/alerts/kit.js'

const SLOT = 200, PRINT = 1100, TEAR = 800 // ms
const LINES = 10 // printing steps
const HEIGHT = 330 // px of paper

export default function ticket(box, { id, text }, ms, { sound }) {
  const line = el('div', 'line', text)
  const paper = el('div', 'ticket-paper',
    el('div', 'ticket-head', '★ ADMIT ONE ★'),
    el('div', 'ticket-text center', line),
    el('div', 'ticket-cut'),
    el('div', 'ticket-stub', el('span', '', `No. ${String(id).padStart(6, '0')}`), el('div', 'ticket-bars')),
  )
  const slot = el('div', 'ticket-slot')
  box.append(el('div', 'ticket-feed', paper), slot)
  fit(line, 322, 170, 34, 16)

  const { k, hold } = timing(ms, SLOT * 2 + PRINT + TEAR)
  const tear = (SLOT + PRINT) * k + hold
  const tl = createTimeline()
    .add(slot, { opacity: [0, 1], duration: SLOT * k }, 0)
    .add(paper, { y: [-HEIGHT, 0], duration: PRINT * k, ease: steps(LINES) }, SLOT * k)
    // A jerk to tear it, then it drops away.
    .add(paper, { rotate: [0, 4], duration: 120 * k, ease: 'outQuad' }, tear)
    .add(paper, { y: 520, rotate: 14, opacity: 0, duration: (TEAR - 120) * k, ease: 'inQuad' }, tear + 120 * k)
    .add(slot, { opacity: 0, duration: SLOT * k }, tear + TEAR * k)
  if (sound) {
    for (let i = 0; i < LINES; i++) tl.call(() => noise(70, { freq: 2600, to: 1500, q: 2, gain: 0.08 }), (SLOT + (i * PRINT) / LINES) * k + 1)
    tl.call(() => noise(260, { freq: 4000, to: 1200, q: 0.8, gain: 0.15 }), tear)
  }
  return tl
}
