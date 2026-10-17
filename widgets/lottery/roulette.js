// Roulette layout (European, 0-36): the rotor turns one way, the ball races the other way on the track, drops,
// bounces across the frets into the winning pocket, then the other pockets dim.
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { REDS } from '/widgets/lottery/widget.js'

// Pocket order around the wheel, clockwise from the top.
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const STEP = 360 / 37
const color = (n) => (n === 0 ? '#0e9f4d' : REDS.includes(n) ? '#d0202e' : '#141418')
const TRACK = 186, POCKET = 128 // ball radius in px: on the track, in a pocket

// Canvases are 880px for 440px on screen; c is their center.
const c = 440
const rad = (deg) => ((deg - 90) * Math.PI) / 180 // canvas angle of a clockwise angle from the top

function canvas(className) {
  const node = el('canvas', className)
  node.width = node.height = 880
  return node
}

// The static bowl: a wooden rim and the polished ball track.
function drawBowl(ctx) {
  const wood = ctx.createRadialGradient(c, c, 380, c, c, 440)
  wood.addColorStop(0, '#3b1d0c'); wood.addColorStop(0.5, '#8a4b22'); wood.addColorStop(1, '#4a230d')
  ctx.beginPath(); ctx.arc(c, c, 436, 0, 2 * Math.PI); ctx.fillStyle = wood; ctx.fill()
  ctx.beginPath(); ctx.arc(c, c, 396, 0, 2 * Math.PI); ctx.fillStyle = '#1b1b20'; ctx.fill()
  ctx.strokeStyle = '#ffb40088'; ctx.lineWidth = 4; ctx.stroke()
}

// The rotor: numbered ring, pockets with golden frets, the cone and its turret. dim darkens all but the winner's pocket.
function drawRotor(ctx, dim = 0, winner = -1) {
  ctx.clearRect(0, 0, 880, 880)
  ORDER.forEach((n, i) => {
    const a = rad(i * STEP - STEP / 2), b = rad(i * STEP + STEP / 2)
    ctx.beginPath(); ctx.arc(c, c, 340, a, b); ctx.arc(c, c, 230, b, a, true); ctx.closePath()
    ctx.fillStyle = color(n); ctx.fill()
    ctx.strokeStyle = '#d9a640'; ctx.lineWidth = 3; ctx.stroke()
    ctx.save(); ctx.translate(c, c); ctx.rotate(rad(i * STEP) + Math.PI / 2)
    ctx.fillStyle = '#fff'; ctx.font = '800 26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(n, 0, -312)
    ctx.restore()
    if (dim && n !== winner) { ctx.fillStyle = `rgba(0, 0, 0, ${dim * 0.65})`; ctx.fill() }
  })
  // Pocket floor: a shadowed band where the ball lands.
  ctx.beginPath(); ctx.arc(c, c, 286, 0, 2 * Math.PI); ctx.arc(c, c, 230, 0, 2 * Math.PI, true)
  ctx.fillStyle = '#0005'; ctx.fill()
  const cone = ctx.createRadialGradient(c - 40, c - 40, 20, c, c, 230)
  cone.addColorStop(0, '#c98a4b'); cone.addColorStop(1, '#5a2d10')
  ctx.beginPath(); ctx.arc(c, c, 230, 0, 2 * Math.PI); ctx.fillStyle = cone; ctx.fill()
  ctx.strokeStyle = '#d9a640'; ctx.lineWidth = 6; ctx.stroke()
  // Turret: a golden cross.
  ctx.fillStyle = '#e8b84a'; ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 3
  for (let k = 0; k < 4; k++) {
    ctx.save(); ctx.translate(c, c); ctx.rotate((k * Math.PI) / 2)
    ctx.beginPath(); ctx.roundRect(-10, -150, 20, 150, 10); ctx.fill(); ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath(); ctx.arc(c, c, 40, 0, 2 * Math.PI); ctx.fill(); ctx.stroke()
}

export default function roulette(stage) {
  const bowl = canvas('roulette-bowl'), rotor = canvas('roulette-rotor')
  const ball = el('div', 'roulette-ball')
  const arm = el('div', 'roulette-arm', ball) // carries the ball around; the ball itself only pops (anime owns its transform)
  stage.append(bowl, rotor, arm)
  drawBowl(bowl.getContext('2d'))
  drawRotor(rotor.getContext('2d'))

  // The ball's angle is the rotor's plus rel, so once in its pocket it turns with the rotor.
  const s = { rotor: 0, rel: 0, r: TRACK, dim: 0 }
  const place = () => {
    rotor.style.rotate = `${s.rotor}deg`
    arm.style.transform = `rotate(${s.rotor + s.rel}deg) translateY(${-s.r}px)`
  }

  let tl
  return {
    play(winner, ms) {
      const pocket = ORDER.indexOf(winner) * STEP
      const laps = Math.max(3, Math.round(ms / 1000)) // counter-clockwise, around the rotor
      const rel = pocket + 360 * Math.floor((s.rel - 360 * laps - pocket) / 360)
      tl = createTimeline()
        .add(s, { dim: 0, duration: 1, onUpdate: () => drawRotor(rotor.getContext('2d')) }, 0)
        .add(ball, { opacity: 1, duration: ms * 0.06 }, 0)
        .add(s, { rotor: s.rotor + 300 + Math.random() * 120, duration: ms * 0.92, ease: 'outQuad', onUpdate: place }, 0)
        .add(s, { rel, duration: ms * 0.84, ease: 'outCubic', onUpdate: place }, 0)
        // Out of the last pocket onto the track, round and round, then down across the frets.
        .add(s, { r: [{ to: TRACK, duration: ms * 0.08, ease: 'outQuad' }, { to: TRACK, duration: ms * 0.4 }, { to: POCKET, duration: ms * 0.3, ease: 'outBounce' }], onUpdate: place }, 0)
        .add(s, { dim: 1, duration: ms * 0.1, ease: 'outQuad', onUpdate: () => drawRotor(rotor.getContext('2d'), s.dim, winner) }, ms * 0.88)
        .add(ball, { scale: [1, 1.6, 1], duration: ms * 0.12, ease: 'outElastic(1, .5)' }, ms * 0.88)
      return tl
    },
    stop() { tl?.pause() },
    destroy() { this.stop() },
    tint: (winner) => color(winner),
  }
}
