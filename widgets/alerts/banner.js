// Banner layout: the text on a dark card at the top, sliding down into place, then fading out.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, timing } from '/widgets/alerts/kit.js'

const IN = 400, OUT = 400 // ms

export default function banner(box, { text }, ms) {
  const line = el('div', 'line', text)
  const card = el('div', 'banner-card card', line)
  box.append(card)
  fit(line, 680, 380, 48, 18)
  const { k, hold } = timing(ms, IN + OUT)
  return createTimeline()
    .add(card, { opacity: [0, 1], y: [-20, 0], duration: IN * k, ease: 'outQuad' }, 0)
    .add(card, { opacity: 0, y: -20, duration: OUT * k, ease: 'inQuad' }, IN * k + hold)
}
