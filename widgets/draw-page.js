// Page side of the draw widgets (Lottery, Roulette, Dice Roll): builds the layout and plays each draw.
import { engine } from 'animejs'
import { subscribe, wait } from '/widgets/lib.js'

// OBS may hide the source: draws keep time with the server instead of pausing.
engine.pauseOnDocumentHidden = false

// build(stage, board, config, res) makes the layout: canvases in the stage, HTML pieces on the board, drawn at res
// (device pixels per design px). It returns { play(winner, ms) → anime timeline that ends on the winner, stop(),
// destroy() }. It is rebuilt when its config (configure(state), the state by default) changes, or the page is resized.
// The page shows no result text: the winner is in the workflow's data ({{winner}}), for an alert or a chat message to
// announce it.
export function mount(build, { playMs, configure = (state) => state }) {
  const stage = document.getElementById('stage')
  const board = Object.assign(document.createElement('div'), { id: 'board' })
  let layout, key, lastSpin = 0, shown
  function rebuild(config) {
    const k = Math.min(innerWidth, innerHeight) / 440 // the board's scale: as big as the page allows
    document.documentElement.style.setProperty('--k', k)
    layout?.destroy()
    stage.replaceChildren()
    board.replaceChildren()
    layout = build(stage, board, config, k * devicePixelRatio)
    stage.append(board) // over the canvases
    shown = config
  }
  addEventListener('resize', () => shown && rebuild(shown))

  let tl // the draw playing, or played last
  subscribe(({ state, runtime }) => {
    const config = configure(state)
    if (JSON.stringify(config) !== key) {
      key = JSON.stringify(config)
      rebuild(config)
    }
    if (runtime.winner < 0 || runtime.at === lastSpin || runtime.ended || runtime.layout !== (config.layout ?? '')) return
    lastSpin = runtime.at
    const ms = playMs(config)
    const played = Math.min(Math.max(Date.now() - runtime.at, 0), ms) // a page opened mid-draw catches up
    layout.stop()
    tl = layout.play(runtime.winner, ms).seek(played)
    return wait(ms - played) // finished once the draw is over
  }, {
    stop: () => tl?.seek(tl.duration), // the draw jumps to its end, on the winner
    cancel: () => layout?.stop(), // the draw freezes where it is
  })
}
