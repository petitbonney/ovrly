// Marquee layout: a news ticker bar across the page; the text scrolls through it once, right to left.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { timing } from '/widgets/alerts/kit.js'

const IN = 300, OUT = 300 // ms: the bar opening and closing

export default function marquee(box, { text }, ms) {
  const track = el('div', 'marquee-track', text)
  const bar = el('div', 'marquee-bar', el('div', 'marquee-tag', 'LIVE'), track)
  box.append(bar)
  const { k, hold } = timing(ms, IN + OUT)
  return createTimeline()
    .add(bar, { scaleY: [0, 1], opacity: [0, 1], duration: IN * k, ease: 'outQuad' }, 0)
    // From the right edge until it has passed behind the tag on the left.
    .add(track, { x: [bar.clientWidth, -track.clientWidth], duration: hold, ease: 'linear' }, IN * k)
    .add(bar, { scaleY: 0, opacity: 0, duration: OUT * k, ease: 'inQuad' }, IN * k + hold)
}
