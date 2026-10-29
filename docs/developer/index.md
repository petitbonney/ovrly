# Architecture

Ovrly is one Node.js process: an Express server that runs workflows, serves the React editor, and serves widget pages to OBS. Plain JavaScript (ESM), no TypeScript, no database.

```
Twitch chat,
Stream Deck ──► Event bus ──► Workflow engine ──► Actions
                                                    ├─ Widget (SSE → browser source)
                                                    ├─ Key Press (nut.js)
                                                    ├─ HTTP Request
                                                    ├─ WebSocket client (OBS)
                                                    └─ Hue bridge (HTTPS, local)
```

- **Event bus**: an in-process `EventEmitter`. Every source publishes events to it: chat, EventSub, API calls, Stream Deck presses.
- **Workflow**: a list of nodes and edges. When a trigger node matches an event, the engine runs the connected nodes in order, passing a `data` object from one to the next.
- **Widget**: an HTML page served by Express. Its live state is kept on the server and pushed to the page over Server-Sent Events, so OBS sources reconnect by themselves.

## Stack

| Part | Tech |
| --- | --- |
| Server | Node.js, Express, SSE |
| UI | React, ReactFlow, Mantine, Vite |
| Motion | anime.js (v4), three.js through its anime.js adapter, cannon-es for physics |
| Twitch | tmi.js (chat), Helix and EventSub |
| OBS | obs-websocket v5 |
| Philips Hue | the bridge's local API (CLIP v2), its certificate pinned at pairing |
| Stream Deck | a plugin on the Stream Deck SDK's WebSocket protocol, packed with @elgato/cli |
| Key Press | @nut-tree-fork/nut-js |
| Storage | JSON files in `./data` |
| Docs | VitePress, screenshots by Playwright |

## Project layout

```
server/
  index.js        Express routes and startup
  access.js       who reaches Ovrly: this computer, LAN with its key, Host and cross-site checks
  bus.js          event bus, and the recent events (GET /api/events)
  engine.js       runs workflows
  workflows.js    saving and deleting workflows, with what follows (cancel, Merge Widgets, Stream Deck, unused widgets)
  widgets.js      widget state and SSE push
  merge.js        Merge Widgets pages: placement and streams
  store.js        reads/writes ./data
  vars.js         workflow variables
  template.js     {{ }} expressions
  files.js        the OS file dialog, and media files on disk
  windows.js      open windows, for Key Press
  icons.js        Tabler icons for node types and Stream Deck keys
  custom.js       custom node and widget types from ./data/custom, and the helpers they get
  nodes/          one file per node type
  integrations/   one module per outside service, with its routes:
    twitch.js       chat (tmi.js), Guest and Streamer modes
    twitch-auth.js  streamer sign-in, Helix API
    twitch-eventsub.js  EventSub events
    obs.js          obs-websocket connection
    streamdeck.js   Stream Deck plugin link: decks with key images, pairing, presses
    hue.js          Philips Hue bridge: pairing, paced commands, routines playing
    giphy.js        Giphy search
    myinstants.js   Myinstants search
    fonts.js        Google Fonts families
ui/               React app (Vite); starter workflows in ui/src/templates.js
widgets/          one folder per widget type (index.html + widget.js)
streamdeck/       the Ovrly Stream Deck plugin (com.ovrly.deck.sdPlugin)
docs/             this site (VitePress), and its screenshot script
test/             node --test
data/             your widgets, workflows, settings and custom/ types (gitignored)
```

## Data

Each workflow, widget and setting is one JSON file: `data/<kind>/<id>.json`, kinds `workflows`, `widgets` and `settings`. A widget node carries:

- `state`: saved in its widget file (settings, action inputs, kept data such as the lottery's options);
- `runtime`: in memory, lost on restart (what plays now: a draw, a vote under way).

Import/export moves a bundle `{ widgets: [...], workflows: [...] }`.
