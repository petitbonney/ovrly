# Ovrly

> Node-based automation for live stream interactions.

Ovrly lets you connect stream events (Twitch chat) to actions (overlays, key presses, HTTP calls, OBS) by drawing a graph, the way n8n works, but for streamers.

**Status:** prototype. JavaScript only, Twitch chat only, OBS only.

## Features

- **Workflows**: node graphs of the form trigger → logic → action. Build one from scratch or start from a template.
- **Widgets**: built-in browser-source overlays: alerts, poll, bets, spin wheel, TwitchPlays.
- **Multiple instances**: run several widgets and workflows side by side.
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
│ Widgets +│                              │  Nodes    │
│  - alert │   Node graph (workflow)      │  library  │
│  - poll  │        or                    │ (drag &   │
│Workflows+│   Widget config (widget)     │   drop)   │
│  - !spin │                              │           │
│          ├──────────────────────────────┤           │
│          │  Node config (selected node) │           │
└──────────┴──────────────────────────────┴───────────┘
```

- **Left**: widget and workflow lists. **+** opens the library or the template picker.
- **Center**: the node graph of the selected workflow, or the settings of the selected widget.
- **Right**: the node library. Drag a node onto the graph.
- **Bottom**: settings of the selected node.

## How it works

```
Twitch chat ──► Event bus ──► Workflow engine ──► Actions
                                                    ├─ Widget (WebSocket → browser source)
                                                    ├─ Key press (nut.js)
                                                    ├─ HTTP request
                                                    └─ WebSocket client (OBS)
```

- **Event bus**: an in-process `EventEmitter`. Every source publishes events to it.
- **Workflow**: a list of nodes and edges. When a trigger node matches an event, the engine runs the connected nodes in order and passes a `data` object from one node to the next.
- **Widget**: an HTML page served by Express. It receives state updates over WebSocket.

## Stack

| Part      | Tech                          |
| --------- | ----------------------------- |
| Server    | Node.js, Express, `ws`        |
| UI        | React, ReactFlow, Vite        |
| Twitch    | tmi.js (chat)                 |
| OBS       | obs-websocket-js (v5)         |
| Key press | @nut-tree/nut-js              |
| Storage   | JSON files in `./data`        |

## Project layout

```
server/
  index.js        Express, WebSocket and startup
  bus.js          event bus
  engine.js       runs workflows
  store.js        reads/writes ./data
  nodes/          one file per node type
  sources/        twitch.js, …
ui/               React app (Vite)
widgets/          one folder per widget type (html + config schema)
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

## Import / export

Each workflow and widget is a single JSON file in `./data`. Use **Export** to download one, and **Import** (or just drop the file into `./data`) to load one.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
