// Dice layout (three.js), toon-styled after a 3D dice demo, with a real throw (cannon-es physics): the die is picked
// up, thrown in, bounces, rolls and tips over until it rests, then pops. The throw is computed in a few ms before it
// plays: once we know which face lands on top, the die's faces are turned (invisibly: a cube looks the same) so that
// face is the winner's. Then anime.js replays the recorded throw. A face labelled 1 to 6 shows as dots, other labels as
// text, in the dots color on the dice color; the outline is a dark shade of the dice color.
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createTimeline } from 'animejs'
import 'animejs/adapters/three' // lets anime.js animate three.js objects (x, y, rotateX, scale…)
import { DICE_MS } from '/widgets/lottery/widget.js'

const SIZE = 2.5
const WALL = 4 // invisible walls keep the die in view
const STEP = 1000 / 60 // ms per physics step, one recorded frame each
const PICKUP = 350, POP = 800 // ms: the die leaves before the throw, pops once it rests
const MAX_STEPS = Math.floor((DICE_MS - PICKUP - POP) / STEP) // a throw must rest in time
// Box faces are +x, -x, +y, -y, +z, -z. Face i of the options goes where real dice put it (opposite faces add up to 7).
const SLOT = [0, 2, 4, 5, 3, 1]
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((v) => new THREE.Vector3(...v))
const DOTS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] }

function face(label, color, dots) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = dots
  if (DOTS[label]) {
    for (const [x, y] of DOTS[label]) { ctx.beginPath(); ctx.arc(x * 64, y * 64, 24, 0, 2 * Math.PI); ctx.fill() }
  } else {
    ctx.font = `900 ${Math.min(120, 520 / Math.max(label.length, 1))}px system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 132)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: texture })
}

// Throws a die from above the view in a world of its own and records every step until it rests. Returns
// { frames, up: the box face on top }, or null if it didn't rest flat in time.
function simulate() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -90, 0), allowSleep: true })
  world.defaultContactMaterial.restitution = 0.3
  world.defaultContactMaterial.friction = 0.3
  // The floor, then four walls facing in.
  for (const [position, axis, angle] of [[[0, 0, 0], [1, 0, 0], -Math.PI / 2], [[-WALL, 0, 0], [0, 1, 0], Math.PI / 2],
    [[WALL, 0, 0], [0, 1, 0], -Math.PI / 2], [[0, 0, -WALL], [0, 1, 0], 0], [[0, 0, WALL], [0, 1, 0], Math.PI]]) {
    const plane = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() })
    plane.position.set(...position)
    plane.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), angle)
    world.addBody(plane)
  }
  const r = (min, max) => min + Math.random() * (max - min)
  const die = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)), sleepSpeedLimit: 0.3, sleepTimeLimit: 0.15 })
  die.position.set(r(-3, -1), 11, r(-3, -1))
  die.quaternion.setFromEuler(r(0, 6.3), r(0, 6.3), r(0, 6.3))
  die.velocity.set(r(5, 9), r(-6, -2), r(5, 9)) // towards the camera
  die.angularVelocity.set(r(-15, 15), r(-15, 15), r(-15, 15))
  world.addBody(die)
  const frames = []
  while (die.sleepState !== CANNON.Body.SLEEPING) {
    if (frames.length > MAX_STEPS) return null
    world.step(1 / 60)
    frames.push([...die.position.toArray(), ...die.quaternion.toArray()])
  }
  const q = new THREE.Quaternion(...die.quaternion.toArray())
  const up = NORMALS.findIndex((n) => n.clone().applyQuaternion(q).y > 0.95)
  return up < 0 ? null : { frames, up }
}

export default function dice(stage, config) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(2)
  renderer.setSize(440, 440)
  renderer.domElement.className = 'three'
  stage.append(renderer.domElement)

  // Isometric, orthographic: no perspective distortion.
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 1, 200)
  camera.position.set(40, 44, 40)
  camera.lookAt(0, 2.6, 0)

  // body follows the physics (position, rotation) > die is turned within it so the winner's face lands on top.
  const geometry = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.4)
  const materials = []
  config.dice.forEach((label, i) => (materials[SLOT[i]] = face(label, config.diceColor, config.dotColor)))
  const die = new THREE.Mesh(geometry, materials)
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(config.diceColor).multiplyScalar(0.3), side: THREE.BackSide }))
  outline.scale.setScalar(1.06)
  die.add(outline)
  const body = new THREE.Group()
  body.position.y = SIZE / 2
  body.add(die)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(SIZE * 0.65, 48), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 }))
  shadow.rotation.x = -Math.PI / 2
  scene.add(body, shadow)
  // The shadow follows the die on the ground, shrinking and fading as it rises.
  renderer.setAnimationLoop(() => {
    const height = body.position.y - SIZE / 2
    shadow.position.set(body.position.x, 0.01, body.position.z)
    shadow.scale.setScalar(Math.max(0.4, 1 - height * 0.07))
    shadow.material.opacity = Math.max(0, 0.3 - height * 0.03)
    renderer.render(scene, camera)
  })

  let tl
  return {
    play(winner, ms) {
      // Most throws rest flat in time; of a few, the longest fills the time best.
      const sims = []
      for (let i = 0; i < 50 && sims.length < 6; i++) {
        const sim = simulate()
        if (sim) sims.push(sim)
      }
      const { frames, up } = sims.sort((a, b) => b.frames.length - a.frames.length)[0]
      const turn = new THREE.Quaternion().setFromUnitVectors(NORMALS[SLOT[winner]], NORMALS[up])
      const replay = { frame: 0 }
      const show = () => {
        const f = frames[Math.round(replay.frame)]
        body.position.set(f[0], f[1], f[2])
        body.quaternion.set(f[3], f[4], f[5], f[6])
        die.quaternion.copy(turn) // off screen when it changes: the throw starts above the view
      }
      const rest = PICKUP + frames.length * STEP
      tl = createTimeline()
        // Picked up: off the top of the view, spinning.
        .add(body, { y: 14, rotateX: '+=180', scale: 1, duration: PICKUP, ease: 'inQuad' }, 0)
        // The throw, frame by frame as the physics computed it.
        .add(replay, { frame: frames.length - 1, duration: frames.length * STEP, ease: 'linear', onUpdate: show }, PICKUP)
        // Pop: the result face is up.
        .add(body, { scale: [1, 1.25, 1], duration: Math.min(POP, ms - rest), ease: 'outElastic(1, .5)' }, rest)
      return tl
    },
    stop() { tl?.pause() },
    destroy() {
      this.stop()
      renderer.setAnimationLoop(null)
      renderer.dispose()
    },
  }
}
