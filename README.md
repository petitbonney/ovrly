# Ovrly

> Node-based automation for live stream interactions.

Ovrly lets you connect stream events (Twitch chat) to actions (overlays, key presses, HTTP calls, OBS) by drawing a graph, the way n8n works, but for streamers.

**Status:** prototype. JavaScript only, Twitch chat only, OBS only.

## Features

- **Workflows**: node graphs of the form trigger → logic → action. Build one from scratch or start from a template.
- **Widgets**: built-in browser-source overlays: alerts, poll, bets, spin wheel, TwitchPlays.
- **Multiple instances**: run several widgets and workflows side by side.
- **Triggers**: Twitch chat (any message or a `!command`), an API call to `http://localhost:6875/hooks/<path>` (query and JSON body become data), or the Run button in the editor (Manual Trigger).
- **Logic**: filter (continues only if a comparison holds, like if/else), delay (in seconds), if/else, switch (a list
  of cases, one output each, labelled by the case; links follow their case when cases move or are removed), wait for all (continues once every incoming link has delivered),
  cooldown (lets data through, then sends the next to "blocked" for a while, for everyone or per viewer) and
  queue (what follows runs one firing at a time, the next wait in line).
- **Widget concurrency**: an action sent to a widget that is still playing one (e.g. a second `!spin`) cancels it and
  plays the new one; the cancelled run stops there. Put a queue node before the widget to play them in turn instead.
- **Widgets in a workflow**: a widget node (circle) is the "what": one overlay instance. A Fire Widget node is the
  "how": one action on it, run in the flow. Link the widget node's diamond (top) to the diamond under each Fire Widget
  node that drives it; diamonds only connect to diamonds, and each Fire Widget node drives one widget. One widget node
  can drive several Fire Widget nodes, e.g. `!spin` spins the wheel and `!stop` cancels it in the same workflow.
- **List settings** (poll and bets options, wheel options) are edited row by row: add, remove, move up or down.
  Each wheel option has a label, a color and a weight: a bigger weight is a bigger section, so a likelier winner.
- **Show, hide, cancel**: every widget has these actions. "show" and "hide" fade the whole overlay in or out without
  interrupting what it plays (the alert's own "show" shows a text, and the overlay with it). "cancel" stops its
  animation (the wheel freezes, an alert fades out) and stops the run waiting on it. Cancelling a workflow (switch off, Stop all) cancels the widget actions it is playing.
- **Actions**:
  - run an action on a widget overlay (web source) with a **Fire Widget** node
  - press a key on the broadcaster's machine
  - call an HTTP endpoint
  - control software over WebSocket (e.g. OBS)
- **Import/export**: workflows and widgets are plain JSON files.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:6875.

To show a widget in OBS, select its node and copy the browser-source link from the settings pane (`http://localhost:6875/w/<widget-id>`), then add an OBS **Browser Source** with it.

## UI

```
┌──────────┬──────────────────────────────┬───────────┐
│Workflows+│ ↶↷ name ▶ │ ⤓ 🗑 │ ◫         │ Triggers  │
│  - !spin │                              │ Logic     │
│  - poll  │   Node graph (workflow)      │ Actions   │
│          │                              │ Widgets   │
│          ├──────────────────────────────┤ (drag &   │
│ Twitch ● │  Settings of the selected    │   drop)   │
│ channel  │  node                        │           │
└──────────┴──────────────────────────────┴───────────┘
```

- **Left**: workflow list (**+** opens the template picker; the switch next to each name turns a workflow off: what it is running is cancelled and its triggers ignore chat and API calls, while ▶ Run still works; **EMERGENCY** below the list turns them all off at once), and **Integration**: one row each for Twitch and OBS, with a settings button (Twitch channel; OBS WebSocket URL and password) and a status dot (green connected, red not). OBS nodes use that one OBS connection, and their scene and source settings suggest the names from OBS while it is connected.
- **Center**: the node graph of the selected workflow. The toolbar has undo/redo, the name, run manual triggers (▶), then export and delete, then show/hide the library. Chat triggers have a test form in their settings that sends a fake chat message.
- **Right**: the library (workflow only). Drag a node type or a widget type onto the graph. Each widget dropped is a new overlay instance and its widget node, set up from the node's settings: instance ID, name, OBS link, settings, test and live preview. Deleting the node deletes the instance. A Fire Widget node's settings show its linked widget (name and instance ID), then the action to run.
- **Copy/paste**: Ctrl/⌘+C and Ctrl/⌘+V copy the selected nodes, also into another workflow. Pasted widget nodes share the same instance (once per workflow); it is deleted once no workflow uses it anymore. Each instance has its own id, shown in its node's settings with a button that copies the node.
- **Undo/redo**: Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y), or the toolbar arrows. Undoing a widget node's deletion brings its instance back too.
- **Bottom**: settings of the selected node (workflow only; each workflow remembers which node was open, and the graph stays centered as the pane opens), with pickers for options and a **{ }** menu to insert data from previous nodes, e.g. `{{user}}`.
- **Live feedback**: while a workflow runs, its graph shows it: a running node pulses blue, a finished one flashes green, one that stopped the flow (e.g. a filter that didn't match) dims, a failing one turns red (with the error), and links carrying data animate.
- **Graph controls** (top left): zoom, fit view, lock (nodes can't be moved, linked or deleted, but still open their settings), and arrange: a one-shot left-to-right layout (one undo step; nodes stay movable).
- Drag the edge of the right and bottom panes to resize them.
- **Developer mode**: Ctrl+Shift+D (Ctrl on macOS too) shows a tool button at the bottom right that opens `/api/events`: the last 200 events, each tagged with the channel it travelled on: `bus` (chat, API hooks, `/api/emit`), `http` (manual runs, HTTP request nodes), `websocket` (WebSocket send nodes, OBS, the Twitch connection) `sse` (widget actions sent to overlays, and their end with the output) and `log` (Log nodes). A live table in a browser, JSON otherwise (or with `?format=json`).

## How it works

```
Twitch chat ──► Event bus ──► Workflow engine ──► Actions
                                                    ├─ Widget (SSE → browser source)
                                                    ├─ Key Press (nut.js)
                                                    ├─ HTTP Request
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
| Key Press | @nut-tree/nut-js              |
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

Optional metadata makes the settings pane friendlier: `description`, `adds` (the data keys the node adds, offered as `{{key}}` in later nodes) and `fields` (per-setting hints such as `{ options: [...] }`, `{ vars: true }` for `{{key}}` placeholders, or `{ type: 'json' }`; see `ui/src/Fields.jsx`).

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

The page calls `subscribe(({ config, state }) => …)` from `/widgets/lib.js`. A workflow runs a widget's actions with Fire Widget nodes linked to its widget node (drag the widget type from the library, link it, then pick the action). `inputs` lists the actions that take a value and describes it, e.g. `{ show: 'Text to show' }`; other actions get no Value field. A widget type can also give data back to the workflow: `output(state, config)` returns e.g. `{ winner: 'Red' }`, merged into the data for the next nodes, and `adds: ['winner']` lists those keys for the `{ }` menu. The wheel outputs `winner`, bets `winner` and `winners`, the poll `leader` and `votes`. The Fire Widget node waits until the action has finished playing before the next nodes run. If the widget type knows how long an action plays, it says so with `playTime(action, config)` (ms) and the server waits that long, whether or not an overlay page is open (the wheel and alerts do). Otherwise the page reports the end: return a promise from the render function (e.g. `wait(ms)` from `lib.js`) while an animation plays.

## Import / export

Each workflow and widget is a single JSON file in `./data`. Use **Export** to download one, and **Import** (or just drop the file into `./data`) to load one.

## License

MIT
