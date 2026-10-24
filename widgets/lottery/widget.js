// Lottery: "start" draws a winner at random (see ../draw.js), shown with one of two layouts: a wheel of weighted,
// colored options or a slot (one reel). Outputs { winner }, the winning label.
// The wheel and the slot draw from their own options (Custom), or from options loaded from the workflow's data ("load",
// added up until "clear"), kept in the state (state.loaded, saved). Loaded options without a color take the palette's.
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
  if (state.source !== 'data') return state.options
  const colors = palette(state)
  return (state.loaded ?? []).map((o, i) => ({ ...o, color: o.color || colors[i % colors.length] }))
}

// The picked palette's colors (a Custom one left empty: Ovrly's).
export function palette(state) {
  const custom = state.colors.map((c) => c.color)
  return state.palette === 'custom' && custom.length ? custom : PALETTES[state.palette] ?? PALETTES.ovrly
}

// One loaded option from a data item: a label, or { label, color, weight } (color and weight optional); null to skip.
function option(item) {
  const o = item && typeof item === 'object' ? item : { label: item }
  const label = String(o.label ?? '').trim()
  if (!label) return null
  const weight = Number(o.weight)
  return { label, ...(o.color && { color: String(o.color) }), weight: o.weight != null && o.weight !== '' && weight >= 0 ? weight : 1 }
}

const base = draw(choices, playMs)

export default {
  type: 'lottery',
  label: 'Lottery',
  description: 'Draws a winner with a wheel or a slot.',
  state: {
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
    duration: 5,
    loaded: [], // options loaded from data, as given (no palette color)
  },
  fields: {
    layout: {
      options: [{ value: 'wheel', label: 'Wheel' }, { value: 'slots', label: 'Slot' }],
    },
    source: {
      options: [{ value: 'custom', label: 'Custom' }, { value: 'data', label: 'Options from data' }],
      hint: 'From data: the "load" action adds options from the workflow, "clear" removes them',
    },
    options: { only: { source: 'custom' }, hint: 'A bigger weight is a likelier winner' },
    palette: {
      options: [
        { value: 'ovrly', label: 'Ovrly' },
        { value: 'pastel', label: 'Pastel' },
        { value: 'neon', label: 'Neon' },
        { value: 'earth', label: 'Earth' },
        { value: 'custom', label: 'Custom' },
      ],
      only: { source: 'data' },
      hint: 'Colors of the loaded options that come without one',
    },
    colors: { only: { source: 'data', palette: 'custom' } },
    duration: { unit: 's', presets: [3, 5, 8, 12], hint: 'How long a draw lasts' },
  },
  ...base,
  actions: {
    ...base.actions,
    load: {
      description: 'Adds options from the data: a list of labels or of { label, color, weight } (color and weight optional), or one of them. Cancels a draw playing.',
      only: { source: 'data' },
      inputs: { list: { type: 'var', hint: 'The data key holding the options, e.g. items from a Fan In node' } },
      run({ state, runtime, input: { list } }) {
        const added = [list].flat().map(option).filter(Boolean)
        if (added.length) return { state: { ...state, loaded: [...state.loaded, ...added] }, runtime: { ...runtime, winner: -1 } }
      },
    },
    clear: {
      description: 'Removes the options loaded from data. Cancels a draw playing.',
      only: { source: 'data' },
      run: ({ state, runtime }) => (state.loaded.length ? { state: { ...state, loaded: [] }, runtime: { ...runtime, winner: -1 } } : undefined),
    },
  },
}
