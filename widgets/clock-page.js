// Page side of Countdown and Timer: their text, ticking on the page from the state (the server only pushes changes), in
// the font, color, size and alignment set. It's always on screen: "stop" and "cancel" hold the clock, and OBS hides the
// source.
import { animate, engine } from 'animejs'
import { subscribe, loadFont } from '/widgets/lib.js'

engine.pauseOnDocumentHidden = false // OBS may hide the source: the clock still keeps time

// view(state) says what to show now, { text, pulse } (pulse: it beats as its text changes).
export function mount(view) {
  const page = document.getElementById('page'), text = document.getElementById('text')
  let state, beat
  function tick() {
    if (!state) return
    const now = view(state)
    if (now.text === text.textContent) return
    const first = !text.textContent
    text.textContent = now.text
    if (!now.pulse || first) return
    beat?.pause()
    beat = animate(text, { scale: [1.15, 1], duration: 400, ease: 'outQuad' })
  }
  setInterval(tick, 100)
  subscribe((msg) => {
    state = msg.state
    page.style.justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[state.align]
    loadFont(state.font)
    Object.assign(text.style, { fontFamily: `"${state.font}", system-ui, sans-serif`, color: state.color, fontSize: `${state.size}px`, transformOrigin: state.align })
    tick()
  })
}
