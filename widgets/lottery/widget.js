// Lottery: "start" draws a winner at random, shown with one of four layouts: a wheel of weighted, colored options, a
// roulette (0-36), a slot (one reel) or a die. Outputs { winner }, the winning label.
// The wheel and the slot draw from their own options (Custom), or from options loaded from the workflow's data ("load",
// added up until "clear"), kept in the state (in memory). Loaded options without a color take the palette's.
// The page (index.html) imports choices() too, so both sides agree on what each index means.

// European roulette: 0 is green; the reds, the rest black.
export const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

// ms a draw lasts: the duration setting, except for the dice, whose throw follows physics and always takes DICE_MS.
export const DICE_MS = 3500
export const playMs = (config) => (config.layout === 'dice' ? DICE_MS : config.duration * 1000)
// ms the winner shows after "stop" jumps to the end of the draw, before the workflow goes on.
const REVEAL = 1000

export const PALETTES = {
  ovrly: ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ff7a00', '#e03131', '#2f9e44'],
  pastel: ['#b197fc', '#f783ac', '#38d9a9', '#fcc419', '#74c0fc', '#ffa94d', '#ff8787', '#8ce99a'],
  neon: ['#ff00e6', '#00e5ff', '#39ff14', '#ffea00', '#ff3d00', '#7c4dff', '#00ff9d', '#ff1744'],
  earth: ['#8d5524', '#c68642', '#6b8e23', '#556b2f', '#b5651d', '#a0522d', '#708090', '#cd853f'],
}

// What can win with this layout, as [{ label, weight, color }]; index = winner.
export function choices(config, state) {
  if (config.layout === 'roulette') return Array.from({ length: 37 }, (_, n) => ({ label: String(n), weight: 1 }))
  if (config.layout === 'dice') return config.dice.map((label) => ({ label, weight: 1 }))
  if (config.source !== 'data') return config.options // wheel, slots
  const colors = palette(config)
  return (state.options ?? []).map((o, i) => ({ ...o, color: o.color || colors[i % colors.length] }))
}

// The picked palette's colors (a Custom one left empty: Ovrly's).
export function palette(config) {
  const custom = config.colors.map((c) => c.color)
  return config.palette === 'custom' && custom.length ? custom : PALETTES[config.palette] ?? PALETTES.ovrly
}

// One loaded option from a data item: a label, or { label, color, weight } (color and weight optional); null to skip.
function option(item) {
  const o = item && typeof item === 'object' ? item : { label: item }
  const label = String(o.label ?? '').trim()
  if (!label) return null
  const weight = Number(o.weight)
  return { label, ...(o.color && { color: String(o.color) }), weight: o.weight != null && o.weight !== '' && weight >= 0 ? weight : 1 }
}

export default {
  type: 'lottery',
  label: 'Lottery',
  description: 'Draws a winner: a wheel, a roulette, a slot or a die.',
  config: {
    layout: 'wheel',
    source: 'custom',
    options: [
      { label: 'Purple', color: '#9147ff', weight: 1 },
      { label: 'Pink', color: '#ff4f8b', weight: 1 },
      { label: 'Teal', color: '#00c2a8', weight: 1 },
      { label: 'Gold', color: '#ffb400', weight: 1 },
    ],
    palette: 'ovrly',
    colors: [{ color: '#9147ff' }, { color: '#ff4f8b' }, { color: '#00c2a8' }, { color: '#ffb400' }],
    dice: ['1', '2', '3', '4', '5', '6'],
    diceColor: '#9147ff',
    dotColor: '#ffffff',
    duration: 5,
  },
  fields: {
    layout: {
      options: [
        { value: 'wheel', label: 'Wheel' },
        { value: 'slots', label: 'Slot' },
        { value: 'roulette', label: 'Roulette' },
        { value: 'dice', label: 'Dice' },
      ],
    },
    source: {
      options: [{ value: 'custom', label: 'Custom' }, { value: 'data', label: 'Options from data' }],
      only: { layout: ['wheel', 'slots'] },
      hint: 'From data: the "load" action adds options from the workflow, "clear" removes them',
    },
    options: { only: { layout: ['wheel', 'slots'], source: 'custom' }, hint: 'A bigger weight is a likelier winner' },
    palette: {
      options: [
        { value: 'ovrly', label: 'Ovrly' },
        { value: 'pastel', label: 'Pastel' },
        { value: 'neon', label: 'Neon' },
        { value: 'earth', label: 'Earth' },
        { value: 'custom', label: 'Custom' },
      ],
      only: { layout: ['wheel', 'slots'], source: 'data' },
      hint: 'Colors of the loaded options that come without one',
    },
    colors: { only: { layout: ['wheel', 'slots'], source: 'data', palette: 'custom' } },
    dice: { label: 'Faces', fixed: true, only: { layout: 'dice' }, hint: 'A number from 1 to 6 shows as dots' },
    diceColor: { label: 'Dice color', only: { layout: 'dice' } },
    dotColor: { label: 'Dots color', only: { layout: 'dice' }, hint: 'Also the text of faces that are not 1 to 6' },
    duration: { unit: 's', presets: [3, 5, 8, 12], hint: 'How long a draw lasts', only: { layout: ['wheel', 'roulette', 'slots'] } },
  },
  state: { winner: -1, at: 0, options: [] }, // options: loaded from data, as given (no palette color)
  adds: ['winner'],
  output: (state, config) => ({ winner: choices(config, state)[state.winner]?.label ?? '' }),
  playTime: (action, config) => (action === 'start' ? playMs(config) : 0), // the workflow waits for the draw to end
  stopTime: () => REVEAL,
  actions: {
    start: {
      description: 'Draws a winner at random; the workflow goes on with {{winner}} once the draw has ended.',
      run(state, input, config) {
        const options = choices(config, state)
        if (!options.length) throw new Error('Lottery: no options to draw from')
        const weights = options.map((o) => Math.max(0, Number(o.weight) || 0))
        let r = Math.random() * weights.reduce((a, b) => a + b, 0)
        // layout: the page only replays a draw made with the layout it shows.
        // A fresh draw: only the loaded options carry over (not "ended", left by a stop or cancel).
        return { options: state.options, winner: weights.findIndex((w) => (r -= w) < 0), at: Date.now(), layout: config.layout }
      },
    },
    load: {
      description: 'Adds options from the data: a list of labels or of { label, color, weight } (color and weight optional), or one of them. Cancels a draw playing.',
      only: { layout: ['wheel', 'slots'], source: 'data' },
      inputs: { list: { type: 'var', hint: 'The data key holding the options, e.g. items from a Fan In node' } },
      run(state, { list }) {
        const added = [list].flat().map(option).filter(Boolean)
        return added.length ? { ...state, options: [...(state.options ?? []), ...added], winner: -1 } : state
      },
    },
    clear: {
      description: 'Removes the options loaded from data. Cancels a draw playing.',
      only: { layout: ['wheel', 'slots'], source: 'data' },
      run: (state) => (state.options?.length ? { ...state, options: [], winner: -1 } : state),
    },
    stop: { description: 'The draw jumps to its end, on the winner; the workflow goes on with {{winner}}.' },
    cancel: { description: 'The draw freezes where it is; the workflow stops there.' },
  },
}
