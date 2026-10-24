// Wheel layout: weighted, colored sections. It winds back, spins onto the winner while the pin flicks on each
// section edge, then dims the losers while the winner's section pops out. The pin stands on the right, pointing at the center: the
// winning label reads level next to it.
import { animate, createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'

// Each option's section, as fractions of a turn from the top, clockwise: its size is its share of the weights.
function sections(options) {
  const weights = options.map((o) => Math.max(0, Number(o.weight) || 0))
  const total = weights.reduce((a, b) => a + b, 0) || 1
  let start = 0
  return weights.map((w) => {
    const section = { start, size: w / total }
    start += section.size
    return section
  })
}

export default function wheel(stage, board, { options }, res) {
  const parts = sections(options)
  // The canvas fills the page; the wheel is drawn in 880 units (2x the board), centered. It turns around the center.
  const disc = el('canvas', 'fill')
  disc.width = innerWidth * devicePixelRatio
  disc.height = innerHeight * devicePixelRatio
  disc.getContext('2d').setTransform(res / 2, 0, 0, res / 2, (disc.width - 440 * res) / 2, (disc.height - 440 * res) / 2)
  // A stubby map pin: a round head (with a white hole) and its tip 32px to the left; a white edge keeps it visible over a
  // red section.
  const pin = el('div', 'wheel-pin')
  pin.innerHTML = `<svg viewBox="-34 -20 54 40" width="54" height="40">
    <path d="M-10.1 -14.9 A18 18 0 1 1 -10.1 14.9 L-32 0 Z" fill="#e8202a" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <circle r="7" fill="#fff"/></svg>`
  stage.append(disc)
  board.append(el('div', 'wheel-hub'), pin)

  // dim: 0..1, how much the sections other than the winner darken; pop: 0..1, how far the winner's section grows out.
  // The winner is drawn last, over its neighbours.
  function draw(dim = 0, winner = -1, pop = 0) {
    const ctx = disc.getContext('2d')
    const c = 440, R = 380
    ctx.clearRect(0, 0, 880, 880)
    if (!parts.length) { // no options: a grey disc
      ctx.beginPath(); ctx.arc(c, c, R, 0, 2 * Math.PI); ctx.fillStyle = '#3a3a44'; ctx.fill()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fffa'; ctx.font = '800 44px system-ui'
      ctx.fillText('No options', c, c - 90) // above the hub
      return
    }
    const order = parts.map((_, i) => i).sort((i, j) => (i === winner) - (j === winner))
    for (const i of order) {
      const { start, size } = parts[i]
      if (!size) continue
      const r = i === winner ? R * (1 + 0.045 * pop) : R
      const a = -Math.PI / 2 + start * 2 * Math.PI, seg = size * 2 * Math.PI
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, a, a + seg); ctx.closePath()
      ctx.fillStyle = options[i].color; ctx.fill()
      ctx.strokeStyle = '#fff6'; ctx.lineWidth = 4; ctx.stroke()
      ctx.save(); ctx.translate(c, c); ctx.rotate(a + seg / 2)
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#0009'; ctx.shadowBlur = 8
      ctx.font = `800 ${Math.min(44, seg * R * 0.4)}px system-ui`
      ctx.fillText(options[i].label, R - 60, 0) // clear of the pin's tip
      ctx.restore()
      if (dim && i !== winner) { ctx.fillStyle = `rgba(0, 0, 0, ${dim * 0.6})`; ctx.fill() }
    }
  }
  draw()

  // The section under the pin's tip (on the right: a quarter turn from the top), to flick it when that changes.
  const spin = { angle: 0, dim: 0, pop: 0 }
  let under = -1, last = 0
  const sectionAt = (angle) => {
    const at = ((((90 - angle) % 360) + 360) % 360) / 360
    return parts.findIndex(({ start, size }) => at >= start && at < start + size)
  }
  function turn() {
    disc.style.rotate = `${spin.angle}deg`
    const now = sectionAt(spin.angle)
    if (now !== under && under !== -1) animate(pin, { rotate: [spin.angle > last ? -20 : 20, 0], duration: 350, ease: 'outElastic(1, .4)' })
    under = now
    last = spin.angle
  }

  let tl
  return {
    play(winner, ms) {
      const { start, size } = parts[winner]
      const landing = start + size * (0.25 + Math.random() * 0.5) // somewhere inside the section, not always its middle
      const turns = Math.max(3, Math.round(ms / 1000))
      const target = spin.angle - (spin.angle % 360) + 360 * turns + 90 - landing * 360 // landing under the pin's tip
      tl = createTimeline()
        .add(spin, { dim: 0, pop: 0, duration: 1, onUpdate: () => draw() }, 0)
        .add(spin, { angle: spin.angle - 20, duration: ms * 0.1, ease: 'inOutSine', onUpdate: turn }, 0) // wind-up
        .add(spin, { angle: target, duration: ms * 0.76, ease: 'outQuart', onUpdate: turn }, ms * 0.1)
        // The losers dim and the winner's section pops out (and stays out).
        .add(spin, { dim: 1, duration: ms * 0.1, ease: 'outQuad', onUpdate: () => draw(spin.dim, winner, spin.pop) }, ms * 0.86)
        .add(spin, { pop: 1, duration: ms * 0.14, ease: 'outElastic(1, .5)', onUpdate: () => draw(spin.dim, winner, spin.pop) }, ms * 0.86)
      return tl
    },
    stop() { tl?.pause() },
    destroy() { this.stop() },
  }
}
