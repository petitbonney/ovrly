// Shared by the draw widget types (Lottery, Roulette, Dice Roll): "start" draws a winner at random among choices(state),
// weighted, and the page plays the draw for playMs(state) ms. Outputs { winner }, the winning label. Each widget.js
// spreads draw(choices, playMs) into its type; its page calls mount() from /widgets/draw-page.js.

// ms the winner shows after "stop" jumps to the end of the draw, before the workflow goes on.
const REVEAL = 1000

export function draw(choices, playMs) {
  return {
    runtime: { winner: -1, at: 0, layout: '' }, // layout: the one the draw was made with (Lottery's wheel or slot)
    adds: ['winner'],
    output: ({ state, runtime }) => ({ winner: choices(state)[runtime.winner]?.label ?? '' }),
    playTime: (action, { state }) => (action === 'start' ? playMs(state) : 0), // the workflow waits for the draw to end
    stopTime: () => REVEAL,
    actions: {
      start: {
        description: 'Draws a winner at random; the workflow goes on with {{winner}} once the draw has ended.',
        run({ state }) {
          const options = choices(state)
          if (!options.length) throw new Error('No options to draw from')
          const weights = options.map((o) => Math.max(0, Number(o.weight) || 0))
          let r = Math.random() * weights.reduce((a, b) => a + b, 0)
          // layout: the page only replays a draw made with the layout it shows.
          // A fresh runtime: not "ended", left by a stop or cancel.
          return { runtime: { winner: weights.findIndex((w) => (r -= w) < 0), at: Date.now(), layout: state.layout ?? '' } }
        },
      },
      stop: { description: 'The draw jumps to its end, on the winner; the workflow goes on with {{winner}}.' },
      cancel: { description: 'The draw freezes where it is; the workflow stops there.' },
    },
  }
}
