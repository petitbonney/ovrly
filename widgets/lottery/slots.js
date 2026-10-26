// Slot layout: one reel of the options. The lever is pulled, the reel kicks up, blurs into a roll downwards, lands
// past the winner and clunks back onto the payline, then the winning tile pulses. Bulbs along the top and bottom of the cabinet play a light show, at rest too.
// The cabinet fills the page (the OBS source), whatever its shape: wider, it has more bulbs; taller, more tiles show.
import { animate, createTimeline, createTimer } from 'animejs'
import { el } from '/widgets/lib.js'

const TILE = 100 // px per tile, margins included; the middle one is on the payline
const SPEED = 24 // tiles per second at full speed
const MAX_BLUR = 10 // px, vertical, at full speed
const KICK = 300, ACCEL = 450, DECEL = 1100, CLUNK = 300, WIN = 700 // ms of each move

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

// Each pattern gives a bulb's brightness (0..1) from its place on the loop (i, and at: 0..1, the top row in the first
// half), the phase (loops travelled) and the seconds since the pattern started.
const patterns = {
  // At rest, a marquee: every third bulb lit, marching round the loop (right on top, left at the bottom).
  idle: (i, at, phase, time) => 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (i / 3 - time * 1.2))) ** 3,
  // While drawing, bright heads with fading tails behind them, as fast as the reel.
  chase: (i, at, phase) => 0.2 + 0.8 * Math.max(0, 1 - frac(COMETS * (phase - at)) * 2.5),
  // On the win, the rows flash in turn, then every bulb sparkles at random.
  flash: (i, at, phase, time) => ((Math.floor(time * 8) + (at < 0.5 ? 0 : 1)) % 2 ? 0.15 : 1),
  sparkle: (i, at, phase, time, seed) => 0.25 + 0.75 * Math.max(0, Math.sin(2 * Math.PI * (time * 2 + seed))) ** 4,
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
        const v = patterns[pattern](i, i / lights.length, phase, time, seeds[i])
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

export default function slots(stage, board, { options, text }, res) {
  // The board takes the page's shape, 440px on its short side; the cabinet and its window follow it (index.html).
  const k = res / devicePixelRatio, W = innerWidth / k, H = innerHeight / k
  board.style.width = `${W}px`
  board.style.height = `${H}px`
  const cabinet = { w: W - 100, h: H - 20 }
  const m = Math.ceil(((cabinet.h - 120) / 2 + 44) / TILE) // tiles above and below the payline's, enough to fill the window
  const n = options.length
  const option = (i) => (n ? options[((i % n) + n) % n] : { label: i ? '' : 'No options', color: '#3a3a44' }) // no options: blank tiles
  // Each option's font size: the biggest (30 down to 16) at which its label fits a tile on two lines, without breaking
  // a word. Measured once, on a hidden label in the page (the board isn't on it yet); tiles cut the rest short.
  const probe = el('div', 'slots-label probe')
  probe.style.width = `${cabinet.w - 104}px` // a tile's
  document.body.append(probe)
  const sizes = new Map(options.map((o) => {
    probe.textContent = o.label
    let size = 30
    for (; size > 16; size -= 2) {
      probe.style.fontSize = `${size}px`
      if (probe.scrollHeight < size * 2.5 && probe.scrollWidth <= probe.clientWidth) break
    }
    return [o, size]
  }))
  probe.remove()
  // The tiles, repainted as the reel turns: the strip never grows, however long the draw.
  const tiles = Array.from({ length: 2 * m + 1 }, () => el('div', 'slots-tile', el('div', 'slots-label')))
  const strip = el('div', 'slots-strip', ...tiles)
  // Vertical motion blur (an SVG filter: CSS blur would smear sideways too).
  const defs = el('div', 'slots-defs')
  defs.innerHTML = '<svg width="0" height="0"><filter id="reel-blur" x="0" y="-20%" width="100%" height="140%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>'
  const blur = defs.querySelector('feGaussianBlur')
  // Two rows of bulbs about 35px apart, as a loop: the top one left to right, the bottom one right to left.
  const row = Math.round((cabinet.w - 60) / 35) + 1, gap = (cabinet.w - 60) / (row - 1)
  const lights = bulbs([
    ...Array.from({ length: row }, (_, i) => [30 + i * gap, 16]),
    ...Array.from({ length: row }, (_, i) => [cabinet.w - 30 - i * gap, cabinet.h - 16]),
  ])
  const knob = el('div', 'slots-knob'), stick = el('div', 'slots-stick')
  board.append(
    defs,
    el('div', 'slots-cabinet', ...lights, el('div', 'slots-window', strip), el('div', 'slots-payline left'), el('div', 'slots-payline right')),
    el('div', 'slots-base'), stick, knob,
  )
  const show = lightShow(lights)

  // pos: the tile on the payline (a float while turning). The reel rolls down: pos decreases.
  const r = { pos: 0, blur: 0 }
  let base
  function render() {
    const b = Math.floor(r.pos)
    if (b !== base) {
      base = b
      tiles.forEach((tile, j) => {
        const o = option(b - m + j)
        tile.firstChild.textContent = o.label
        tile.firstChild.style.fontSize = `${sizes.get(o) ?? 30}px`
        tile.style.color = text
        tile.style.background = `linear-gradient(${o.color}, color-mix(in srgb, ${o.color}, #000 35%))`
      })
    }
    strip.style.transform = `translateY(${(b - m - r.pos) * TILE}px)`
    blur.setAttribute('stdDeviation', `0 ${r.blur}`)
    strip.style.filter = r.blur > 0.2 ? 'url(#reel-blur)' : ''
  }
  render()

  let tl
  return {
    play(winner, ms) {
      // Fixed-length moves (ms); a longer draw only means a longer spin at full speed.
      const k = Math.min(1, ms / (KICK + ACCEL + DECEL + CLUNK + WIN)) // a very short draw speeds them up
      const [kick, accel, decel, clunk, win] = [KICK, ACCEL, DECEL, CLUNK, WIN].map((d) => d * k)
      const cruise = ms - kick - accel - decel - clunk - win
      // Tiles travelled at SPEED (accelerating covers half, slowing down a third), rounded to land on the winner.
      const rough = Math.round((SPEED * (accel / 2 + cruise + decel / 3)) / 1000)
      const from = Math.round(r.pos)
      const target = from - rough - ((((from - rough - winner) % n) + n) % n)
      const [t1, t2, t3] = [kick, kick + accel, kick + accel + cruise] // accelerating, full speed, slowing down
      const land = t3 + decel + clunk
      tl = createTimeline({ defaults: { onUpdate: render } })
        .add(stick, { scaleY: [{ to: -0.6, duration: kick * 0.8, ease: 'inQuad' }, { to: 1, duration: 600 * k, ease: 'outElastic(1, .5)' }] }, 0)
        .add(knob, { translateY: [{ to: 176, duration: kick * 0.8, ease: 'inQuad' }, { to: 0, duration: 600 * k, ease: 'outElastic(1, .5)' }] }, 0)
        .add(r, { pos: from + 0.25, duration: kick, ease: 'inOutQuad' }, 0) // kicks up before rolling down
        .add(r, { pos: from + 0.25 - (SPEED * accel) / 2000, duration: accel, ease: 'inQuad' }, t1)
        .add(r, { pos: target - 0.3 + (SPEED * decel) / 3000, duration: cruise, ease: 'linear' }, t2)
        .add(r, { pos: target - 0.3, duration: decel, ease: 'outCubic' }, t3) // a bit past the winner…
        .add(r, { pos: target, duration: clunk, ease: 'outBack(2)' }, t3 + decel) // …and clunks back onto it
        // The blur follows the speed: up while accelerating, gone as it slows down.
        .add(r, { blur: MAX_BLUR, duration: accel, ease: 'linear' }, t1)
        .add(r, { blur: 0, duration: decel, ease: 'outQuad' }, t3)
        // The bulbs chase with the reel: building up with the lever, racing, slowing down, then the win.
        .call(() => show.chase(0.3), 0)
        .call(() => show.chase(1.2), t1)
        .call(() => show.chase(0.6), t3)
        .call(() => show.chase(0.25), t3 + decel / 2)
        .call(show.win, land)
        .add(tiles[m], { scale: [1, 1.12, 1], duration: win, ease: 'outElastic(1, .4)' }, land)
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
