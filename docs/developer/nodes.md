# Writing a node

Each node type is one file in `server/nodes/`, exporting its metadata and a `run` function:

```js
// server/nodes/http-request.js
import { fill } from '../template.js'

export default {
  type: 'http-request',
  label: 'HTTP Request',
  icon: 'world', // a Tabler icon name
  category: 'action', // trigger, logic or action
  group: 'System', // its sub-section in the library
  config: { url: '', method: 'POST' }, // defaults; the UI renders a form from this
  async run({ config, data }) {
    const res = await fetch(fill(config.url, data), { method: config.method, body: JSON.stringify(data) })
    return { ...data, status: res.status } // passed to the next node
  },
}
```

`run` returns the data for the next node, or `null` to stop the flow there. Settings arrive as typed: fill their `{{ }}` with `fill(text, data)` from `server/template.js` (or `fillJson`, `fillUrl`, `value`, `list`).

## Metadata

| Key | What it's for |
| --- | --- |
| `description` | The one line under the node's name in its settings. |
| `adds` | The data keys it adds, offered as `{{key}}` in later nodes. |
| `fields` | Per-setting hints: `{ options: [...] }`, `{ vars: true }` for `{{key}}` placeholders, `{ type: 'json' }`, a short `hint`, a longer `info` (an ⓘ), a `section` heading, `only: { otherSetting: value }` to show it only then. See `ui/src/Fields.jsx`. |
| `outputs` | Several outputs, e.g. `['true', 'false']`; `run` returns `{ [output]: data }` to pick which continue. |
| `event` | For a trigger: the bus event it listens to, or a list; `run` gets the one that fired as `event`. |
| `needs` | Requirement keys: `twitch`, `obs`, `streamdeck`, `giphy`, `hue`, or `chat`. The UI marks the node when one isn't ready. |
| `play` | `true` (or `{ only: { … } }`) gives its settings a Play button and the result, to try it. |
| `manual` | For a trigger: how it fires by hand (below). |
| `iconRotate` | Degrees, for an icon that needs turning. |

## Firing a trigger by hand

A trigger with `manual` gets a ⚡ on the graph and a **Fire** section in its settings, which fire it as if its event had happened: the workflow really runs from there.

```js
// server/nodes/cheer.js
manual: {
  config: (config) => ({ bits: Number(config.minBits) || 1, user: '{{ $vars.channel }}', message: '' }),
  fields: { bits: { presets: [1, 100, 500, 1000, 5000] } },
  event: ({ bits, user, message }) => ({ data: { user_name: user, bits: Number(bits), message } }),
},
```

- `config`: the inputs the Fire section asks for, as a node's `config` (an object, or a function of the node's settings, so that the first values get through them). The ones typed are saved with the node.
- `fields`: hints for those inputs, as `fields` are for settings.
- `event(inputs, config)`: the event they make, `{ event, data }`, shaped like the real one, so it goes through `run` and its filters. `event` defaults to the node's first.

A trigger with nothing to ask for has only `event`, e.g. Manual Trigger's `manual: { event: () => ({ data: {} }) }`.

## Twitch features

A feature that needs the streamer signed in says so: `needs: ['twitch']` on the whole type, or `{ value, label, streamer: true }` on one option (disabled in Guest mode). On the server, call `needStreamer('Feature name')` from `server/integrations/twitch.js` before using it.

## Settings layout

Every node's settings pane has the same layout, so write `config` and `fields` to fit it:

- **Order** is the `config` order: the main choice first (a mode or action that changes which other settings show), then what it acts on, then details, timing, and extra options last.
- **Sections** only for more than about 5 visible settings.
- **Labels** in sentence case. A humanized key is fine when it reads well (`minBits` → "Min bits"). Units go in `unit`, not the label.
- **Hints** are one short line; anything longer goes in `info`.
- Errors and hints that point to a setting name its place, e.g. `Settings → Twitch`.

[AGENTS.md](https://github.com/petitbonney/ovrly/blob/master/AGENTS.md) has the full rules.
