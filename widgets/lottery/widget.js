// Lottery: "start" draws a winner at random (see ../draw.js), shown with one of two layouts: a wheel of weighted options
// or a slot (one reel), colored by the palette. Outputs { winner }, the winning label.
// "load" and "loadAll" add options from the workflow, "clear" removes them all; a draw playing goes on with the options
// it was made with. The wheel stays on the winner until "reset" (or the next draw) shows the options as they are now;
// "reset" is the cancel action (onCancel), so it also cuts a draw playing.
// The page (index.html) imports choices() too, so both sides agree on what each index means.
import { draw } from '../draw.js'

export const playMs = (state) => state.duration * 1000

export const PALETTES = {
  ovrly: ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ff7a00', '#e03131', '#2f9e44'],
  pastel: ['#b197fc', '#f783ac', '#38d9a9', '#fcc419', '#74c0fc', '#ffa94d', '#ff8787', '#8ce99a'],
  neon: ['#ff00e6', '#00e5ff', '#39ff14', '#ffea00', '#ff3d00', '#7c4dff', '#00ff9d', '#ff1744'],
  earth: ['#8d5524', '#c68642', '#6b8e23', '#556b2f', '#b5651d', '#a0522d', '#708090', '#cd853f'],
}

// What can win, as [{ label, weight, color }]; index = winner.
export function choices(state) {
  const colors = palette(state)
  return state.options.map((o, i) => ({ ...o, color: colors[i % colors.length] }))
}

// The picked palette's colors (a Custom one left empty: Ovrly's).
export function palette(state) {
  const custom = state.colors.map((c) => c.color)
  return state.palette === 'custom' && custom.length ? custom : PALETTES[state.palette] ?? PALETTES.ovrly
}

// The labels' color: the Custom palette's own, else white.
export const textColor = (state) => (state.palette === 'custom' ? state.textColor : '#ffffff')

// One option to add: a label, and a weight (1 when left out).
function option(label, weight) {
  label = String(label ?? '').trim()
  const w = weight == null || weight === '' ? 1 : Number(weight)
  if (!label) throw new Error('An option needs a label')
  if (!(w >= 0)) throw new Error(`"${label}": the weight must be a number, 0 or more`)
  return { label, weight: w }
}

const add = (state, added) => ({ state: { ...state, options: [...state.options, ...added] } })

const base = draw(choices, playMs)
const { cancel, ...actions } = base.actions // reset cancels instead

export default {
  type: 'lottery',
  label: 'Lottery',
  description: 'Draws a winner with a wheel or a slot.',
  state: {
    layout: 'wheel',
    options: [
      { label: 'Purple', weight: 1 },
      { label: 'Pink', weight: 1 },
      { label: 'Teal', weight: 1 },
      { label: 'Gold', weight: 1 },
    ],
    palette: 'ovrly',
    colors: [{ color: '#9147ff' }, { color: '#ff4f8b' }, { color: '#00c2a8' }, { color: '#ffb400' }],
    textColor: '#ffffff',
    duration: 5,
  },
  fields: {
    layout: {
      options: [{ value: 'wheel', label: 'Wheel' }, { value: 'slots', label: 'Slot' }],
    },
    options: { hint: 'A bigger weight is a likelier winner' },
    palette: {
      options: [
        { value: 'ovrly', label: 'Ovrly' },
        { value: 'pastel', label: 'Pastel' },
        { value: 'neon', label: 'Neon' },
        { value: 'earth', label: 'Earth' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    colors: { type: 'palette', text: 'textColor', only: { palette: 'custom' } },
    textColor: { hidden: true }, // picked in colors' grid
    duration: { unit: 's', presets: [3, 5, 8, 12], hint: 'How long a draw lasts' },
  },
  ...base,
  onCancel: 'reset',
  // Adding or removing options doesn't replace the draw playing; a new draw does.
  queues: (action) => action !== 'start',
  actions: {
    ...actions,
    load: {
      description: 'Adds one option. A draw playing goes on with its options.',
      inputs: {
        label: { vars: true },
        weight: { vars: true, hint: '1 when left empty' },
      },
      run: ({ state, input: { label, weight } }) => add(state, [option(label, weight)]),
    },
    loadAll: {
      description: 'Adds a list of { label, weight } options (weight optional). A draw playing goes on with its options.',
      inputs: { options: { type: 'list', row: { label: '', weight: 1 } } },
      run({ state, input: { options } }) {
        if (!Array.isArray(options) || options.some((o) => !o || typeof o !== 'object')) throw new Error('Expects a list of { label, weight }')
        if (options.length) return add(state, options.map((o) => option(o.label, o.weight)))
      },
    },
    clear: {
      description: 'Removes all the options. A draw playing goes on with its options.',
      run: ({ state }) => (state.options.length ? { state: { ...state, options: [] } } : undefined),
    },
    reset: {
      description: 'Shows the options as they are now, leaving the last winner. A draw playing stops there, and so does the workflow.',
      run: ({ runtime }) => (runtime.options ? { runtime: { ...base.runtime } } : undefined),
    },
  },
}
