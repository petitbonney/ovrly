# Ovrly

> Node-based automation for live stream interactions.

Ovrly lets you connect stream events (Twitch chat) to actions (overlays, key presses, HTTP calls, OBS) by drawing a graph, the way n8n works, but for streamers.

**Status:** prototype. JavaScript only, Twitch chat only, OBS only.

## Features

- **Workflows**: node graphs of the form trigger → logic → action. Build one from scratch or start from a template.
- **Widgets**: built-in browser-source overlays: alerts, poll, bets, spin wheel, TwitchPlays.
- **Multiple instances**: run several widgets and workflows side by side.
- **Triggers**: Twitch chat (any message or a `!command`), an API call to `http://localhost:3000/hooks/<path>` (query and JSON body become data), or the Run button in the editor (Manual trigger).
- **Logic**: filter, delay, if/else, switch, and wait for all (continues once every incoming link has delivered).
- **Actions**:
  - update a widget overlay (web source)
  - press a key on the broadcaster's machine
  - call an HTTP endpoint
  - control software over WebSocket (e.g. OBS)
- **Import/export**: workflows and widgets are plain JSON files.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

To show a widget in OBS, add a **Browser Source** pointing to `http://localhost:3000/w/<widget-id>`.

## UI

```
┌──────────┬──────────────────────────────┬───────────┐
│Workflows+│ name  ▶ 💬 ⬓ ◫ ⤓ 🗑          │ Triggers  │
│  - !spin │                              │ Logic     │
│  - poll  │   Node graph (workflow)      │ Actions   │
│          │                              │ Widgets + │
│          ├──────────────────────────────┤ (drag &   │
│ Twitch ● │  Settings of the selected    │   drop)   │
│ channel  │  node                        │           │
└──────────┴──────────────────────────────┴───────────┘
```

- **Left**: workflow list (**+** opens the template picker), and the Twitch channel with its connection status.
- **Center**: the node graph of the selected workflow. The toolbar runs manual triggers (▶), sends a test chat message, toggles the side panes, exports and deletes.
- **Right**: the library (workflow only). Drag a node type or a widget onto the graph; click a widget to edit it (settings, test, live preview, OBS link) and **+** to add one. Widget names are unique.
- **Bottom**: settings of the selected node (workflow only), with pickers for options and a **{ }** menu to insert data from previous nodes, e.g. `{user}`.
- Drag the edge of the right and bottom panes to resize them.

## How it works

```
Twitch chat ──► Event bus ──► Workflow engine ──► Actions
                                                    ├─ Widget (SSE → browser source)
                                                    ├─ Key press (nut.js)
                                                    ├─ HTTP request
                                                    └─ WebSocket client (OBS)
```

- **Event bus**: an in-process `EventEmitter`. Every source publishes events to it.
- **Workflow**: a list of nodes and edges. When a trigger node matches an event, the engine runs the connected nodes in order and passes a `data` object from one node to the next.
- **Widget**: an HTML page served by Express. Its live state is kept on the server and pushed to the page over Server-Sent Events, so OBS sources reconnect by themselves.

## Stack

| Part      | Tech                          |
| --------- | ----------------------------- |
| Server    | Node.js, Express, SSE         |
| UI        | React, ReactFlow, Vite        |
| Twitch    | tmi.js (chat)                 |
| OBS       | obs-websocket v5 (built-in WebSocket) |
| Key press | @nut-tree/nut-js              |
| Storage   | JSON files in `./data`        |

## Project layout

```
server/
  index.js        Express, WebSocket and startup
  bus.js          event bus
  engine.js       runs workflows
  widgets.js      widget state and SSE push
  store.js        reads/writes ./data
  nodes/          one file per node type
  sources/        twitch.js, …
ui/               React app (Vite)
widgets/          one folder per widget type (index.html + widget.js)
templates/        starter workflows
data/             your widgets and workflows (gitignored)
```

## Writing a node

Each node type is a single file that exports its metadata and a `run` function:

```js
// server/nodes/http-request.js
export default {
  type: 'http-request',
  label: 'HTTP Request',
  category: 'action',
  config: { url: '', method: 'POST' },   // defaults; the UI renders a form from this
  async run({ config, data }) {
    const res = await fetch(config.url, { method: config.method, body: JSON.stringify(data) })
    return { ...data, status: res.status }  // passed to the next node
  },
}
```

Optional metadata makes the settings pane friendlier: `description`, `adds` (the data keys the node adds, offered as `{key}` in later nodes) and `fields` (per-setting hints such as `{ options: [...] }`, `{ vars: true }` for `{key}` placeholders, or `{ type: 'json' }`; see `ui/src/Fields.jsx`).

A node with several outputs declares them, e.g. `outputs: ['true', 'false']`, and returns `{ [output]: data }` to pick which ones continue. A trigger sets `event` to the bus event it listens to.

## Writing a widget

Each widget type is a folder in `widgets/`: `widget.js` holds the config defaults and the actions (pure functions that return the new state), and `index.html` renders it.

```js
// widgets/poll/widget.js
export default {
  type: 'poll',
  label: 'Poll',
  config: { title: 'Poll', options: 'Yes, No' },
  state: { votes: {} },
  actions: {
    vote: (state, { value, user }, config) => ({ votes: { ...state.votes, [user]: value } }),
    reset: () => ({ votes: {} }),
  },
}
```

The page calls `subscribe(({ config, state }) => …)` from `/widgets/lib.js`. A workflow runs a widget's actions with a widget node (drag the widget from the library, then pick the action). The node waits until the page has finished playing the action before the next nodes run: return a promise from the render function (e.g. `wait(ms)` from `lib.js`) while an animation plays.

## Import / export

Each workflow and widget is a single JSON file in `./data`. Use **Export** to download one, and **Import** (or just drop the file into `./data`) to load one.

## License

MIT
