// Wheel layout: weighted, colored sections. It winds back, spins onto the winner while the pointer flicks on each
// section edge, then dims the losers while the hub pops.
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

export default function wheel(stage, { options }) {
  const parts = sections(options)
  const disc = el('canvas', 'wheel-disc')
  disc.width = disc.height = 840 // drawn at 2x for crisp text
  const pointer = el('div', 'wheel-pointer')
  const hub = el('div', 'wheel-hub')
  stage.append(disc, el('div', 'wheel-rim'), hub, pointer)

  // dim: 0..1, how much the sections other than the winner darken.
  function draw(dim = 0, winner = -1) {
    const ctx = disc.getContext('2d')
    const c = 420
    ctx.clearRect(0, 0, 840, 840)
    parts.forEach(({ start, size }, i) => {
      if (!size) return
      const a = -Math.PI / 2 + start * 2 * Math.PI, seg = size * 2 * Math.PI
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, c, a, a + seg); ctx.closePath()
      ctx.fillStyle = options[i].color; ctx.fill()
      ctx.strokeStyle = '#fff6'; ctx.lineWidth = 4; ctx.stroke()
      ctx.save(); ctx.translate(c, c); ctx.rotate(a + seg / 2)
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#0009'; ctx.shadowBlur = 8
      ctx.font = `800 ${Math.min(44, seg * c * 0.4)}px system-ui`
      ctx.fillText(options[i].label, c - 36, 0)
      ctx.restore()
      if (dim && i !== winner) { ctx.fillStyle = `rgba(0, 0, 0, ${dim * 0.6})`; ctx.fill() }
    })
  }
  draw()

  // The section under the pointer, to flick it when that changes.
  const spin = { angle: 0, dim: 0 }
  let under = -1, last = 0
  const sectionAt = (angle) => {
    const at = (((-angle % 360) + 360) % 360) / 360
    return parts.findIndex(({ start, size }) => at >= start && at < start + size)
  }
  function turn() {
    disc.style.rotate = `${spin.angle}deg`
    const now = sectionAt(spin.angle)
    if (now !== under && under !== -1) animate(pointer, { rotate: [spin.angle > last ? -24 : 24, 0], duration: 350, ease: 'outElastic(1, .4)' })
    under = now
    last = spin.angle
  }

  let tl
  return {
    play(winner, ms) {
      const { start, size } = parts[winner]
      const landing = start + size * (0.25 + Math.random() * 0.5) // somewhere inside the section, not always its middle
      const turns = Math.max(3, Math.round(ms / 1000))
      const target = spin.angle - (spin.angle % 360) + 360 * turns + 360 - landing * 360
      tl = createTimeline()
        .add(spin, { dim: 0, duration: 1, onUpdate: () => draw() }, 0)
        .add(spin, { angle: spin.angle - 20, duration: ms * 0.1, ease: 'inOutSine', onUpdate: turn }, 0) // wind-up
        .add(spin, { angle: target, duration: ms * 0.76, ease: 'outQuart', onUpdate: turn }, ms * 0.1)
        .add(spin, { dim: 1, duration: ms * 0.1, ease: 'outQuad', onUpdate: () => draw(spin.dim, winner) }, ms * 0.86)
        .add(hub, { scale: [1, 1.25, 1], duration: ms * 0.12, ease: 'outElastic(1, .5)' }, ms * 0.86)
      return tl
    },
    stop() { tl?.pause() },
    destroy() { this.stop() },
  }
}
