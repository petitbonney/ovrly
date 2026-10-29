# Writing a widget

Each widget type is a folder in `widgets/`: `widget.js` declares its settings and actions (run on the server), and `index.html` is the overlay page that shows it.

```js
// widgets/counter/widget.js
export default {
  type: 'counter',
  label: 'Counter',
  icon: 'number',
  description: 'Shows a count.',
  state: { title: 'Count', count: 0 }, // saved in the widget's file: settings, and data kept across restarts
  fields: { title: {}, count: { hidden: true } }, // the settings form, as for nodes
  runtime: { shown: 0 }, // in memory only: what plays now, reset on restart
  playTime: () => 0, // the workflow goes on at once
  actions: {
    start: { description: 'Shows the count.', run: ({ state, runtime }) => ({ runtime: { ...runtime, shown: state.count } }) },
    add: {
      description: 'Adds to the count.',
      inputs: { value: { vars: true, default: '1', hint: 'How much, e.g. {{args}}' } },
      run: ({ state, input }) => ({ state: { ...state, count: state.count + Number(input.value) } }),
    },
  },
}
```

## Actions

Each is `{ description, inputs, only, run }`.

- `run({ state, runtime, input })` returns the parts it changes, `{ state?, runtime? }` (nothing: it did nothing). It may be async (e.g. a Twitch call); throwing refuses the action.
- `inputs` says what it asks for on the node, as node fields, filled from the data when it runs: e.g. `{ option: { vars: true, hint }, user: { vars: true, default: '{{user}}' } }`, `{ image: { type: 'image' } }` for a file picker (`image`, `sound` or `video`), or `{ type: 'list' }` for a list.
- `only` shows an action only with some settings, as for fields (Voting's `vote`: `{ mode: 'chat' }`).
- `description` and `inputs` are listed in the node's ⓘ tooltip.

A state also holds `name` (the widget's) and `input` (the inputs set on its node), filled in by Ovrly.

## Running in a workflow

The widget node runs its `start` action, or the one named by `onSignal` (TwitchPlays: `'push'`); Widget Action nodes in front of it run the others. Every type has `stop` (ends what plays, the workflow goes on) and `cancel` (cuts it, the workflow stops there): give them a `run` to do more (Voting closes the vote), or bind other actions with `onStart`, `onStop` and `onCancel` (the lottery's `onCancel: 'reset'`).

The node waits until what it started has stopped:

- `playTime(action, { state, runtime })` (ms) says how long an action plays, and the server waits that long, page open or not (alerts, the draw widgets); 0 goes on at once. Without it, the page reports the end: its render returns a promise (e.g. `wait(ms)` from `lib.js`), and with no page open it goes on at once.
- `stopTime({ state, runtime })` (ms, 0 by default): after "stop", the workflow goes on once the outro has played.
- An action arriving while another plays replaces it (that run stops there), unless `queues(action, snap)` says so (alerts in some layouts, votes while a vote is open): then both play. `over(snap)` ends what plays early, as stopped (a vote closed on Twitch).
- `output({ state, runtime })` gives data back to the workflow once it has stopped, e.g. `{ winner: 'Red' }`, and `adds: ['winner']` lists those keys for the `{ }` menu.
- `on: { 'channel.poll.progress': (snap, data) => ({ runtime }) }` updates its widgets from bus events, such as Twitch EventSub notifications.

## The page

```html
<!-- widgets/counter/index.html -->
<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="/widgets/base.css">
<div class="card" id="count"></div>
<script type="module">
  import { subscribe } from '/widgets/lib.js'
  subscribe(({ state, runtime }) => {
    document.getElementById('count').textContent = `${state.title}: ${runtime.shown}`
  })
</script>
```

`subscribe(render, { stop, cancel })` from `/widgets/lib.js` calls `render` now and on every update. When "stop" or "cancel" ends what plays, its handler runs instead (play an outro, or cut); a page without one renders the new state. Once something has ended, `runtime.ended` is set, so a page opened later doesn't replay it; `runtime.firing` says whether a run still plays.

- Text from chat goes in with `el()` from `lib.js` or `textContent`, **never as HTML**.
- Shared code (e.g. a fade's duration) is imported from `/widgets/<type>/widget.js`.
- Animate with **anime.js** (v4), the standard across Ovrly. 3D goes through three.js, animated with anime.js's Three.js adapter; physics through cannon-es. Pages load them from `/vendor/` with an import map: see `widgets/dice/index.html`.
