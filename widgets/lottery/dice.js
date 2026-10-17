// Dice layout (three.js), toon-styled after a 3D dice demo: the die crouches, is tossed up tumbling, bounces
// twice and settles with the winning face on top, then pops. A face labelled 1 to 6 shows as dots, other labels as text,
// in the dots color on the dice color; the outline is a dark shade of the dice color.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createTimeline, utils } from 'animejs'
import 'animejs/adapters/three' // lets anime.js animate three.js objects (x, y, rotateX, scale…)

const SIZE = 2.5
// Box faces are +x, -x, +y, -y, +z, -z. Face i of the options goes where real dice put it (opposite faces add up
// to 7), and UP[slot] is the turn (degrees around x and z) that brings that slot on top.
const SLOT = [0, 2, 4, 5, 3, 1]
const UP = [[0, 90], [0, -90], [0, 0], [180, 0], [-90, 0], [90, 0]]
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

  // root sits on the ground (squash from there) > spin turns around the up axis > die tumbles around x and z.
  const geometry = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.4)
  const materials = []
  config.dice.forEach((label, i) => (materials[SLOT[i]] = face(label, config.diceColor, config.dotColor)))
  const die = new THREE.Mesh(geometry, materials)
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(config.diceColor).multiplyScalar(0.3), side: THREE.BackSide }))
  outline.scale.setScalar(1.06)
  die.add(outline)
  const spin = new THREE.Group()
  spin.position.y = SIZE / 2
  spin.add(die)
  const root = new THREE.Group()
  root.add(spin)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(SIZE * 0.65, 48), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 }))
  shadow.rotation.x = -Math.PI / 2
  scene.add(root, shadow)
  // The shadow shrinks and fades as the die rises.
  renderer.setAnimationLoop(() => {
    shadow.scale.setScalar(Math.max(0.4, 1 - root.position.y * 0.07))
    shadow.material.opacity = Math.max(0.05, 0.3 - root.position.y * 0.03)
    renderer.render(scene, camera)
  })

  let tl
  return {
    play(winner, ms) {
      const [x, z] = UP[SLOT[winner]]
      const deg = (r) => r * (180 / Math.PI)
      const ahead = (from, to, turns) => from - (from % 360) + 360 * turns + to // the angle `to`, some turns further
      const t = (f) => ms * f
      tl = createTimeline()
        .add(root, { scaleY: [{ to: 0.72, duration: t(0.1), ease: 'outQuad' }, { to: 1.15, duration: t(0.05), ease: 'outQuad' }, { to: 1, duration: t(0.08) }] }, 0)
        .add(root, { scaleX: [{ to: 1.15, duration: t(0.1), ease: 'outQuad' }, { to: 1, duration: t(0.1) }] }, 0)
        // Toss and two bounces, each landing a little squash.
        .add(root, {
          y: [{ to: 6, duration: t(0.17), ease: 'outQuad' }, { to: 0, duration: t(0.17), ease: 'inQuad' },
            { to: 2, duration: t(0.09), ease: 'outQuad' }, { to: 0, duration: t(0.09), ease: 'inQuad' },
            { to: 0.6, duration: t(0.05), ease: 'outQuad' }, { to: 0, duration: t(0.05), ease: 'inQuad' }],
        }, t(0.12))
        .add(root, { scaleY: [{ to: 0.8, duration: t(0.03) }, { to: 1, duration: t(0.06), ease: 'outBack(3)' }] }, t(0.46))
        .add(die, { rotateX: ahead(deg(die.rotation.x), x, 3), rotateZ: ahead(deg(die.rotation.z), z, 2), duration: t(0.66), ease: 'outCubic' }, t(0.12))
        .add(spin, { rotateY: deg(spin.rotation.y) + utils.random(180, 540), duration: t(0.7), ease: 'outCubic' }, t(0.12))
        // Pop: the result face is up.
        .add(root, { scale: [1, 1.3, 1], duration: t(0.14), ease: 'outElastic(1, .5)' }, t(0.86))
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
