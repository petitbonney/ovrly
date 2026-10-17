// Dice layout (three.js), toon-styled after a 3D dice demo, with real physics (cannon-es): the die is kicked off from
// where it rests, bounces off the floor and the edges of the view, rolls and tips over until it rests, then pops.
// Before it plays, random kicks are tried in a few ms until one lands with the winner's face on top; anime.js then
// replays that kick. A face labelled 1 to 6 shows as dots, other labels as
// text, in the dots color on the dice color; the outline is a dark shade of the dice color.
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createTimeline } from 'animejs'
import 'animejs/adapters/three' // lets anime.js animate three.js objects (x, y, rotateX, scale…)
import { DICE_MS } from '/widgets/lottery/widget.js'

const SIZE = 2.5
const STEP = 1000 / 60 // ms per recorded frame
const SUBSTEPS = 8 // physics steps per frame: at this speed, fewer would let the die sink into a wall
const POP = 800 // ms: the die pops once it rests
const MAX_STEPS = Math.floor((DICE_MS - POP) / STEP) // a kick must rest in time
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

// Kicks a die from its resting pose ({ position, quaternion } arrays) in a world of its own: the floor, and walls
// (planes { point, normal }) along the edges of the view. Records every step until it rests. Returns
// { frames, up: the box face on top }, or null if it didn't rest flat in time.
function simulate(start, walls) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -90, 0), allowSleep: true })
  world.defaultContactMaterial.restitution = 0.4 // the floor: a little bounce,
  world.defaultContactMaterial.friction = 0.15 // and slippery enough for the die to reach the walls
  // The walls are bouncy and slick: the die rebounds off the edges of the view.
  const wall = new CANNON.Material(), dieMaterial = new CANNON.Material()
  world.addContactMaterial(new CANNON.ContactMaterial(wall, dieMaterial, { restitution: 0.85, friction: 0.05 }))
  for (const [i, { point, normal }] of [{ point: [0, 0, 0], normal: [0, 1, 0] }, ...walls].entries()) {
    const plane = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: i ? wall : undefined })
    plane.position.set(...point)
    plane.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(...normal)) // a plane faces its +z
    world.addBody(plane)
  }
  const r = (min, max) => min + Math.random() * (max - min)
  const die = new CANNON.Body({ mass: 1, material: dieMaterial, shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)), sleepSpeedLimit: 0.3, sleepTimeLimit: 0.15 })
  die.position.set(...start.position)
  die.quaternion.set(...start.quaternion)
  // A very hard kick: away in a random direction (and a bit up), spinning, so it bounces off several walls.
  const direction = r(0, 2 * Math.PI), speed = r(100, 140)
  die.velocity.set(Math.cos(direction) * speed, r(12, 20), Math.sin(direction) * speed)
  die.angularVelocity.set(r(-30, 30), r(-30, 30), r(-30, 30))
  world.addBody(die)
  const frames = []
  while (die.sleepState !== CANNON.Body.SLEEPING) {
    if (frames.length > MAX_STEPS) return null
    for (let i = 0; i < SUBSTEPS; i++) world.step(1 / 60 / SUBSTEPS)
    frames.push([...die.position.toArray(), ...die.quaternion.toArray()])
  }
  const q = new THREE.Quaternion(...die.quaternion.toArray())
  const up = NORMALS.findIndex((n) => n.clone().applyQuaternion(q).y > 0.95)
  return up < 0 ? null : { frames, up }
}

export default function dice(stage, board, config) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(devicePixelRatio)
  renderer.setSize(innerWidth, innerHeight) // fills the page
  renderer.domElement.className = 'fill'
  stage.append(renderer.domElement)

  // Isometric, orthographic: no perspective distortion.
  const scene = new THREE.Scene()
  const aspect = innerWidth / innerHeight
  const camera = new THREE.OrthographicCamera(-6 * aspect, 6 * aspect, 6, -6, 1, 200)
  camera.position.set(40, 44, 40)
  camera.lookAt(0, 2.6, 0)
  // Walls on the four edges of the canvas, facing in: the die bounces off them. From the view's center, the side edges
  // are 6 × aspect units away, the top and bottom ones 6.
  const center = new THREE.Vector3(0, 2.6, 0)
  const walls = [[[1, 0, 0], 6 * aspect], [[0, 1, 0], 6]].flatMap(([axis, half]) => {
    const v = new THREE.Vector3(...axis).applyQuaternion(camera.quaternion) // the view's right, then its up
    return [1, -1].map((side) => ({ point: center.clone().addScaledVector(v, half * side).toArray(), normal: v.clone().multiplyScalar(-side).toArray() }))
  })

  // body follows the physics (position, rotation) > die, turned within it only if no kick found the winner (rare).
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
      // Kick until one lands with the winner's face on top: one in six of the kicks that rest flat in time, so a few
      // dozen tries, a few ms. Should none (rare), the last good kick is used and the faces turned to match (visible).
      const start = { position: body.position.toArray(), quaternion: body.quaternion.toArray() }
      const wanted = NORMALS[SLOT[winner]].clone().applyQuaternion(die.quaternion) // the winner's face, in the body
      let kick, fallback
      for (let i = 0; i < 1000 && !kick; i++) {
        const sim = simulate(start, walls)
        if (sim && NORMALS[sim.up].dot(wanted) > 0.9) kick = sim
        else fallback = sim ?? fallback
      }
      if (!kick) {
        kick = fallback
        die.quaternion.setFromUnitVectors(NORMALS[SLOT[winner]], NORMALS[kick.up])
      }
      const { frames } = kick
      const replay = { frame: 0 }
      const show = () => {
        const f = frames[Math.round(replay.frame)]
        body.position.set(f[0], f[1], f[2])
        body.quaternion.set(f[3], f[4], f[5], f[6])
      }
      const rest = frames.length * STEP
      tl = createTimeline()
        .set(body, { scale: 1 }, 0)
        // The kick, frame by frame as the physics computed it.
        .add(replay, { frame: frames.length - 1, duration: rest, ease: 'linear', onUpdate: show }, 0)
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
