// Lottery: "spin" draws a winner at random, shown with one of four layouts: a wheel of weighted, colored options, a
// roulette (0-36), a slot (one reel) or a die. Outputs { winner }, the winning label.
// The page (index.html) imports choices() too, so both sides agree on what each index means.

// European roulette: 0 is green; the reds, the rest black.
export const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

// ms a draw lasts: the duration setting, except for the dice, whose throw follows physics and always takes DICE_MS.
export const DICE_MS = 3500
export const playMs = (config) => (config.layout === 'dice' ? DICE_MS : config.duration * 1000)

// What can win with this layout, as [{ label, weight }]; index = winner.
export function choices(config) {
  if (config.layout === 'roulette') return Array.from({ length: 37 }, (_, n) => ({ label: String(n), weight: 1 }))
  if (config.layout === 'dice') return config.dice.map((label) => ({ label, weight: 1 }))
  return config.options // wheel, slots
}

export default {
  type: 'lottery',
  label: 'Lottery',
  description: 'Draws a winner: a wheel, a roulette, a slot or a die.',
  config: {
    layout: 'wheel',
    options: [
      { label: 'Purple', color: '#9147ff', weight: 1 },
      { label: 'Pink', color: '#ff4f8b', weight: 1 },
      { label: 'Teal', color: '#00c2a8', weight: 1 },
      { label: 'Gold', color: '#ffb400', weight: 1 },
    ],
    dice: ['1', '2', '3', '4', '5', '6'],
    diceColor: '#9147ff',
    dotColor: '#ffffff',
    duration: 5,
  },
  fields: {
    layout: {
      options: [
        { value: 'wheel', label: 'Wheel' },
        { value: 'roulette', label: 'Roulette' },
        { value: 'slots', label: 'Slot' },
        { value: 'dice', label: 'Dice' },
      ],
    },
    options: { only: { layout: ['wheel', 'slots'] }, hint: 'A bigger weight is a likelier winner' },
    dice: { label: 'Faces', fixed: true, only: { layout: 'dice' }, hint: 'A number from 1 to 6 shows as dots' },
    diceColor: { label: 'Dice color', only: { layout: 'dice' } },
    dotColor: { label: 'Dots color', only: { layout: 'dice' }, hint: 'Also the text of faces that are not 1 to 6' },
    duration: { unit: 's', presets: [3, 5, 8, 12], hint: 'How long a draw lasts', only: { layout: ['wheel', 'roulette', 'slots'] } },
  },
  state: { winner: -1, at: 0 },
  adds: ['winner'],
  output: (state, config) => ({ winner: choices(config)[state.winner]?.label ?? '' }),
  main: 'spin', // what a widget node runs; other actions go through Widget Action nodes
  playTime: (action, config) => playMs(config), // the workflow waits for the draw to end
  actions: {
    spin(state, input, config) {
      const weights = choices(config).map((o) => Math.max(0, Number(o.weight) || 0))
      let r = Math.random() * weights.reduce((a, b) => a + b, 0)
      // layout: the page only replays a draw made with the layout it shows.
      return { winner: weights.findIndex((w) => (r -= w) < 0), at: Date.now(), layout: config.layout }
    },
  },
}
