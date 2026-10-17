// Slot layout: one reel of the options. The lever is pulled, the reel kicks back, blurs into a spin, lands
// past the winner and clunks back onto the payline, then the winning tile pulses. Bulbs along the top and bottom of the cabinet play a light show, at rest too.
import { animate, createTimeline, createTimer, utils } from 'animejs'
import { el } from '/widgets/lib.js'

const TILE = 100 // px per tile, margins included; the window shows three, the middle one is the payline
const LAPS = 6 // full rounds of the reel per draw

const ROW = 9 // bulbs per row
// The two rows of bulbs (cabinet px), as a loop: the top one left to right, the bottom one right to left.
const FRAME = [...Array.from({ length: ROW }, (_, i) => [30 + i * 35, 16]), ...Array.from({ length: ROW }, (_, i) => [310 - i * 35, 404])]

// Bulbs centered on these [x, y] points (px), in chase order; every other one is pink.
function bulbs(points) {
  return points.map(([x, y], i) => {
    const bulb = el('div', i % 2 ? 'light alt' : 'light')
    bulb.style.left = `${x - 5}px`
    bulb.style.top = `${y - 5}px`
    return bulb
  })
}

const frac = (v) => ((v % 1) + 1) % 1
const COMETS = 2

// Each pattern gives a bulb's brightness (0..1) from its place on the loop (i), the phase (loops travelled) and the
// seconds since the pattern started.
const patterns = {
  // At rest, a marquee: every third bulb lit, marching round the loop (right on top, left at the bottom).
  idle: (i, phase, time) => 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (i / 3 - time * 1.2))) ** 3,
  // While drawing, bright heads with fading tails behind them, as fast as the reel.
  chase: (i, phase) => 0.2 + 0.8 * Math.max(0, 1 - frac(COMETS * (phase - i / FRAME.length)) * 2.5),
  // On the win, the rows flash in turn, then every bulb sparkles at random.
  flash: (i, phase, time) => ((Math.floor(time * 8) + (i < ROW ? 0 : 1)) % 2 ? 0.15 : 1),
  sparkle: (i, phase, time, seed) => 0.25 + 0.75 * Math.max(0, Math.sin(2 * Math.PI * (time * 2 + seed))) ** 4,
}

// The reel calls chase(speed) as it speeds up and slows down (speed: laps per second, eased so the comets never
// jump), win() when it lands and idle() when it stops. One timer paints every bulb on each frame.
function lightShow(lights) {
  const seeds = lights.map(() => Math.random())
  const s = { speed: 0.12 }
  let pattern = 'idle', phase = 0, time = 0, last = 0
  const set = (name, speed) => {
    pattern = name
    time = 0
    animate(s, { speed, duration: 600, ease: 'outQuad' })
  }
  const timer = createTimer({
    onUpdate: (self) => {
      const dt = (self.currentTime - last) / 1000
      last = self.currentTime
      phase += dt * s.speed
      time += dt
      if (pattern === 'flash' && time > 1) set('sparkle', s.speed)
      if (pattern === 'sparkle' && time > 2) set('idle', 0.12)
      lights.forEach((bulb, i) => {
        const v = patterns[pattern](i, phase, time, seeds[i])
        bulb.style.opacity = v
        bulb.style.scale = 0.75 + 0.45 * v
      })
    },
  })
  return {
    idle: () => set('idle', 0.12),
    chase: (speed) => set('chase', speed),
    win: () => set('flash', 0),
    stop: () => timer.pause(),
  }
}

export default function slots(stage, { options }) {
  // The reel repeats the options, enough for the laps plus a round on each side.
  const tiles = Array.from({ length: options.length * (LAPS + 2) }, (_, i) => {
    const o = options[i % options.length]
    const tile = el('div', 'slots-tile', o.label)
    tile.style.background = `linear-gradient(${o.color}, color-mix(in srgb, ${o.color}, #000 35%))`
    return tile
  })
  const strip = el('div', 'slots-strip', ...tiles)
  const lights = bulbs(FRAME)
  const knob = el('div', 'slots-knob'), stick = el('div', 'slots-stick')
  stage.append(
    el('div', 'slots-cabinet', ...lights, el('div', 'slots-window', strip), el('div', 'slots-payline left'), el('div', 'slots-payline right')),
    el('div', 'slots-base'), stick, knob,
  )
  const show = lightShow(lights)
  // Tile i on the payline.
  const y = (i) => -(i - 1) * TILE
  let at = options.length // the tile on the payline, in the first full round
  utils.set(strip, { translateY: y(at) })

  let tl
  return {
    play(winner, ms) {
      const from = at % options.length + options.length
      at = options.length * LAPS + winner
      tl = createTimeline()
        .set(strip, { translateY: y(from) }, 0) // same tile, one round earlier: room to spin
        .add(stick, { scaleY: [{ to: -0.6, duration: ms * 0.08, ease: 'inQuad' }, { to: 1, duration: ms * 0.25, ease: 'outElastic(1, .5)' }] }, 0)
        .add(knob, { translateY: [{ to: 176, duration: ms * 0.08, ease: 'inQuad' }, { to: 0, duration: ms * 0.25, ease: 'outElastic(1, .5)' }] }, 0)
        .add(strip, { translateY: y(from) + 30, duration: ms * 0.1, ease: 'inOutQuad' }, 0) // kick back
        .add(strip, { translateY: y(at) - 34, duration: ms * 0.72, ease: 'outCubic' }, ms * 0.1)
        .add(strip, { translateY: y(at), duration: ms * 0.08, ease: 'outBack(3)' }, ms * 0.82) // clunk
        .add(strip, { filter: ['blur(0px)', 'blur(6px)'], duration: ms * 0.12, ease: 'inQuad' }, ms * 0.1)
        .add(strip, { filter: 'blur(0px)', duration: ms * 0.3, ease: 'outQuad' }, ms * 0.5)
        // The bulbs chase with the reel: building up with the lever, racing, slowing down, then the win.
        .call(() => show.chase(0.3), 0)
        .call(() => show.chase(1.2), ms * 0.1)
        .call(() => show.chase(0.6), ms * 0.5)
        .call(() => show.chase(0.25), ms * 0.7)
        .call(show.win, ms * 0.88)
        .add(tiles[at], { scale: [1, 1.12, 1], duration: ms * 0.12, ease: 'outElastic(1, .4)' }, ms * 0.88)
      return tl
    },
    stop() {
      tl?.pause()
      show.idle()
    },
    destroy() {
      tl?.pause()
      show.stop()
    },
  }
}
