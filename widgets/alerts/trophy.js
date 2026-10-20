// Trophy layout (three.js): a metal trophy drops in, bounces, spins to face the front, confetti bursts on landing, and
// the text shows on an engraved plaque below it. Then the trophy shrinks away.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createTimeline } from 'animejs'
import { el } from '/widgets/lib.js'
import { fit, noise, timing, tone } from '/widgets/alerts/kit.js'

const DROP = 900, PLAQUE = 400, OUT = 500 // ms
const LAND = 0.364 // outBounce first touches the ground at this fraction of the drop
const METALS = { gold: '#ffcf40', silver: '#e3e6ea', bronze: '#d08a52' }
const CONFETTI = ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ffffff']
const W = 320, H = 340 // px of the scene

// The cup's outline, turned around its axis: base, stem, then the bowl, up to the rim and back down inside.
const PROFILE = [[0, 0], [0.75, 0], [0.75, 0.2], [0.45, 0.28], [0.4, 0.42], [0.14, 0.55], [0.13, 1.25], [0.3, 1.4], [0.8, 1.65],
  [1.05, 2.2], [1.15, 3.05], [1.08, 3.1], [0.98, 2.3], [0.72, 1.85], [0, 1.78]]

// One renderer for the page, made on the first trophy: only one shows at a time.
let gl
function setup() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  const light = new THREE.DirectionalLight('#ffffff', 2)
  light.position.set(3, 5, 4)
  scene.add(light)
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100)
  camera.position.set(0, 2.4, 11)
  camera.lookAt(0, 1.5, 0)

  const metal = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.2 })
  const trophy = new THREE.Group()
  trophy.add(new THREE.Mesh(new THREE.LatheGeometry(PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 64), metal))
  for (const side of [1, -1]) {
    // Half a ring on each side of the bowl, as handles.
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 12, 32, Math.PI), metal)
    handle.position.set(side * 1.0, 2.45, 0)
    handle.rotation.z = -side * Math.PI / 2
    trophy.add(handle)
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 1.9), new THREE.MeshStandardMaterial({ color: '#3a2416', roughness: 0.6 }))
  plinth.position.y = -0.275
  trophy.add(plinth)
  scene.add(trophy)
  return { renderer, scene, camera, trophy, metal }
}

export default function trophyLayout(box, { text }, ms, { metal, sound }) {
  gl ??= setup()
  const k0 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1
  gl.renderer.setPixelRatio(k0 * devicePixelRatio)
  gl.renderer.setSize(W, H, false)
  gl.metal.color.set(METALS[metal] ?? METALS.gold)
  const scene = el('div', 'trophy-scene')
  scene.append(gl.renderer.domElement)
  gl.renderer.domElement.style.cssText = 'width: 100%; height: 100%'
  const line = el('div', 'line', text)
  const plaque = el('div', `trophy-plaque center ${metal}`, line)
  const confetti = Array.from({ length: 40 }, (_, i) => {
    const bit = el('div', 'trophy-confetti')
    bit.style.background = CONFETTI[i % CONFETTI.length]
    return bit
  })
  box.append(scene, plaque, ...confetti)
  fit(line, 430, 76, 34, 14)

  const { k, hold } = timing(ms, DROP + PLAQUE + OUT)
  const land = DROP * LAND * k, out = (DROP + PLAQUE) * k + hold
  const s = { y: 7, spin: -4 * Math.PI, scale: 1 }
  const render = () => {
    gl.trophy.position.y = s.y
    gl.trophy.rotation.y = s.spin
    gl.trophy.scale.setScalar(s.scale)
    gl.renderer.render(gl.scene, gl.camera)
  }
  const tl = createTimeline({ onUpdate: render })
    .add(s, { y: [7, 0], duration: DROP * k, ease: 'outBounce' }, 0)
    .add(s, { spin: [-4 * Math.PI, 0], duration: out, ease: 'outQuart' }, 0) // ends facing the front
    .add(plaque, { opacity: [0, 1], y: [40, 0], duration: PLAQUE * k, ease: 'outBack' }, DROP * k)
    .add(s, { scale: [1, 0], y: 1.5, duration: OUT * k, ease: 'inBack' }, out)
    .add(plaque, { opacity: 0, y: 20, duration: OUT * k, ease: 'inQuad' }, out)
  // Confetti: thrown up and out from the landing spot, then fluttering down.
  for (const bit of confetti) {
    const x = (Math.random() - 0.5) * 700, y = -80 - Math.random() * 220
    tl.add(bit, { opacity: [0, 1], x: [0, x], y: [0, y], rotate: [0, Math.random() * 360], duration: 500 * k, ease: 'outQuad' }, land)
      .add(bit, { y: y + 260 + Math.random() * 120, rotate: `+=${360 + Math.random() * 360}`, opacity: 0, duration: 1300 * k, ease: 'inQuad' }, land + 500 * k)
  }
  if (sound) {
    tl.call(() => {
      tone(120, 250, { to: 50, gain: 0.4 })
      tone(2093, 1400, { gain: 0.08 })
      tone(3136, 1000, { gain: 0.04 })
      noise(120, { freq: 2000, gain: 0.15 })
    }, land)
    tl.call(() => tone(900, 300, { to: 200, gain: 0.12 }), out)
  }
  return tl
}
