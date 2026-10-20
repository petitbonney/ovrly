// Sticky note layout: a note slaps onto the screen at a tilt, then peels off and flutters away. Notes stack: each new
// one goes to the next of five spots, over the ones still showing.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, noise, timing, tone } from '/widgets/alerts/kit.js'

const SLAP = 250, PEEL = 900 // ms
const SPOTS = [[80, 40], [460, 60], [270, 170], [60, 195], [480, 200]] // top left of each note (px)
const TILTS = [-5, 4, -2, 6, -4] // deg

export default function sticky(box, { id, text }, ms, { sound }) {
  const line = el('div', 'line', text)
  const note = el('div', 'sticky-note center', el('div', 'sticky-tape'), line)
  const [left, top] = SPOTS[(id - 1) % SPOTS.length]
  Object.assign(note.style, { left: `${left}px`, top: `${top}px` })
  box.append(note)
  fit(line, 216, 188, 40, 14)

  const tilt = TILTS[(id - 1) % TILTS.length]
  const { k, hold } = timing(ms, SLAP + PEEL)
  const peel = SLAP * k + hold
  const tl = createTimeline()
    .add(note, { opacity: [0, 1], scale: [1.5, 1], rotate: [tilt + 10, tilt], duration: SLAP * k, ease: 'outBack(1.2)' }, 0)
    // Lifted by a corner, then carried away, swaying.
    .add(note, { rotate: tilt + 12, y: -12, duration: 150 * k, ease: 'outQuad' }, peel)
    .add(note, {
      x: 260, y: 560, opacity: [1, 0],
      rotate: [{ to: tilt - 20, duration: 250 * k }, { to: tilt + 25, duration: 250 * k }, { to: tilt - 10, duration: 250 * k }],
      duration: 750 * k, ease: 'inQuad',
    }, peel + 150 * k)
  if (sound) {
    tl.call(() => {
      noise(90, { freq: 600, q: 0.7, gain: 0.5 })
      tone(90, 80, { gain: 0.2 })
    }, SLAP * k * 0.6)
    tl.call(() => noise(300, { freq: 3000, to: 800, gain: 0.1 }), peel)
  }
  return tl
}
