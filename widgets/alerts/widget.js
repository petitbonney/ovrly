// Alerts: shows a text, e.g. "bob just ran !hype", for a few seconds in one of ten layouts. A new alert replaces the
// one showing, except in layouts that queue them (one after another) or stack them (side by side). Most layouts play
// sounds, made by the page itself (alerts/kit.js), at the volume setting (0 mutes them).

// arrive: what a new alert does while another shows: 'replace' it, 'queue' after it, or 'stack' next to it.
export const LAYOUTS = {
  banner: { label: 'Banner', arrive: 'replace' },
  neon: { label: 'Neon sign', arrive: 'replace', sound: true },
  ticket: { label: 'Ticket', arrive: 'queue', sound: true },
  bubble: { label: 'Speech bubble', arrive: 'replace', sound: true },
  arcade: { label: 'Arcade', arrive: 'replace', sound: true },
  flap: { label: 'Flap board', arrive: 'queue', sound: true },
  trophy: { label: 'Trophy', arrive: 'replace', sound: true },
  sticky: { label: 'Sticky note', arrive: 'stack', sound: true },
  marquee: { label: 'Marquee', arrive: 'queue' },
  particles: { label: 'Particles', arrive: 'replace', sound: true },
}
const arrive = (config) => LAYOUTS[config.layout]?.arrive ?? 'replace'

// ms an alert lasts on screen, coming in and going out included; queued alerts wait GAP ms between them.
export const life = (config) => config.duration * 1000
const GAP = 300

export default {
  type: 'alerts',
  label: 'Alerts',
  description: 'Shows a text for a few seconds, e.g. who just ran a command: a banner, a neon sign, a flap board…',
  config: { layout: 'banner', duration: 5, color: '#ffb400', metal: 'gold', volume: 100 },
  fields: {
    layout: { options: Object.entries(LAYOUTS).map(([value, { label }]) => ({ value, label })) },
    duration: { unit: 's', presets: [3, 5, 8, 10], hint: 'How long an alert stays on screen (the marquee: one pass)' },
    color: {
      only: { layout: ['neon', 'ticket', 'bubble', 'arcade', 'sticky', 'marquee', 'particles'] },
      hint: 'The neon tube, the note, the burst behind the bubble, the glow…',
    },
    metal: {
      only: { layout: 'trophy' },
      options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }, { value: 'bronze', label: 'Bronze' }],
    },
    volume: {
      unit: '%', slider: true, only: { layout: Object.keys(LAYOUTS).filter((name) => LAYOUTS[name].sound) },
      hint: '0 mutes the sounds. Tick "Control audio via OBS" on the browser source to mix them',
    },
  },
  // items: the alerts on screen or waiting their turn, { id, text, at: when it starts (ms) }; n: the last id given.
  state: { items: [], n: 0 },
  main: 'show', // what a widget node runs; other actions go through Widget Callback nodes
  inputs: { show: 'Text to show, e.g. {{user}} just ran !hype' }, // actions that take a value, and what it is
  // A queued or stacked alert doesn't cut the one showing (server/widgets.js).
  queues: (config) => arrive(config) !== 'replace',
  // The workflow waits until its own alert has gone, queued ones too.
  playTime: (action, config, state) => state.items.at(-1).at + life(config) - Date.now(),
  actions: {
    show(state, { value }, config) {
      const now = Date.now()
      const kept = arrive(config) === 'replace' || state.cancelled ? [] : state.items.filter((i) => i.at + life(config) > now)
      const at = arrive(config) === 'queue' ? Math.max(now, ...kept.map((i) => i.at + life(config) + GAP)) : now
      return { items: [...kept, { id: state.n + 1, text: value, at }], n: state.n + 1 }
    },
  },
}
