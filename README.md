# Ovrly

> Node-based automation for live stream interactions.

Ovrly lets you connect stream events (Twitch chat) to actions (overlays, key presses, HTTP calls, OBS) by drawing a graph, the way n8n works, but for streamers.

**Status:** prototype. JavaScript only, Twitch chat only, OBS only.

## Features

- **Workflows**: node graphs of the form trigger → logic → action. Build one from scratch or start from a template.
- **Widgets**: built-in browser-source overlays: alerts, image/GIF, sound, video, voting, lottery, TwitchPlays. The sound widget plays a sound through its overlay (so it reaches the stream; tick "Control audio via OBS" on the browser source): a file on disk (Browse files), a search on [Myinstants](https://www.myinstants.com) (no API: Ovrly reads its search pages, for personal use), or a URL, e.g. `{{sound}}` from a previous node. Its max duration cuts it with a short fade-out (0 plays all of it) and its volume is a percentage. The video widget plays a short video the same way (a file on disk, mp4 or webm, or a URL; max duration and volume; it fades out at the end). The image/GIF widget shows the image set on its node: a file on disk (picked with Browse files, used where it is), a GIF picked from Giphy (once the Giphy integration has an API key), or a URL, e.g. `{{image}}` from a previous node; it fades in and out. The lottery draws a winner with one of
  four layouts: wheel (weighted, colored options), roulette, slot (one reel) or dice.
  Alerts show a text with one of ten layouts: banner, neon sign, ticket, speech bubble, arcade, flap board, trophy
  (three.js), sticky note, marquee or particles. A new alert replaces the one showing, except on the ticket, flap board
  and marquee (queued, one after another) and sticky notes (stacked); the workflow waits until its own alert has gone.
  Most layouts play sounds, made in the page (no files), at a volume setting (0 mutes them).
- **Voting**: a poll (the most voted option leads) or a prediction (viewers bet, then "win" reveals who guessed right),
  open for its duration after "open", or until "close". Its widget node keeps firing until voting ends, then outputs
  the result; cancelling the workflow, or the Cancel button in its settings, closes the vote. In Chat mode, viewers vote through the "vote" action (`!vote 2`,
  `!vote red`), one vote per viewer, in Guest or Streamer mode. Twitch mode (Streamer mode, the default once signed in)
  runs a native Twitch poll or prediction (channel points; Twitch Affiliates and Partners only), with live results over
  EventSub. It outputs `winner`, `votes` and `winners` (who bet right).
- **TwitchPlays**: translates chat into keys, through a list of command → keys pairs (`up` → `Up`); a Key Press node
  set to `{{keys}}` presses them. Anarchy passes on every command; democracy counts one vote per viewer during the
  vote window, then passes on the winner. Widget Action's `mode` action switches modes mid-stream (dropping a vote
  under way). Key Press's "Only when focused" presses only while that app or window is focused, picked from those
  open (macOS: window titles need the Accessibility permission Key Press already needs).
- **Twitch features**: in Streamer mode, the Voting widget can run a native Twitch poll or prediction. Twitch triggers (follow, subscription, gift subs, cheer, channel points, raids, stream online/offline, hype train) follow EventSub in Streamer mode; subs, gift subs, cheers and raids also work in Guest mode, from what chat announces. Twitch actions (Streamer mode) send chat messages and replies, announcements and shoutouts, time out, ban or delete messages, change the title, category, tags and chat modes, run ads, make clips and stream markers, raid, look up a viewer (follow age, sub tier), and manage channel points rewards and redemptions (Twitch only lets Ovrly change rewards it made: the Channel Points Reward node makes them).
- **Multiple instances**: run several widgets and workflows side by side.
- **Triggers**: a schedule, Twitch chat (any message or a `!command`), an API call to `http://localhost:6875/hooks/<path>` (query and JSON body become data), or the Run button in the editor (Manual Trigger).
- **Logic**: filter (continues only if a comparison holds, like if/else; 13 operators: equals, contains, regex, numbers, empty…), delay (in seconds), if/else, switch (a list
  of cases, one output each, labelled by the case; links follow their case when cases move or are removed), wait for all (continues once every incoming link has delivered),
  cooldown (lets data through, then sends the next to "blocked" for a while, for everyone and optionally per data key),
  fan out (what follows runs once per item of a list, e.g. a gift's recipients) and queue (what follows runs one firing at a time, the next wait in line; its settings show the line, and remove a firing from it).
- **Expressions**: any text setting takes `{{ ... }}`: a path (`{{user}}`, `{{json.items.0.name}}`, `{{$vars.score}}`,
  `{{$node.http-request.status}}` for the output of an earlier node, by type or id) or a JavaScript expression
  (`{{ score * 2 }}`). Expressions and the Code node run as code: only import workflows you trust.
- **Data vs variables**: *data* is the payload that travels from node to node during one run (`{{user}}`), gone when
  the run ends. *Variables* are shared by all workflows and kept across runs and restarts (`{{$vars.score}}`).
  Edit Data changes data; Edit Variable sets, adds to or deletes a variable.
- **More nodes**: Code (JavaScript on the data), Schedule (a trigger every N seconds, minutes or hours),
  Execute Workflow (runs another workflow, which starts with a Called By Workflow trigger, and merges its result in).
- **Errors and history**: a node that fails stops the firing there. An Error Trigger workflow runs when a node fails
  in another one. `GET /api/runs` has the last 100 firings (in memory), with each node's input and output.
- **Widget concurrency**: an action sent to a widget that is still playing one (e.g. a second `!spin`) cancels it and
  plays the new one; the cancelled run stops there. Put a queue node before the widget to play them in turn instead.
- **Widgets in a workflow**: a widget node is one overlay instance, run in the flow like any node: it runs its
  widget's **main action** (lottery: spin, alerts and image: show, voting: open, TwitchPlays: push) with
  the inputs set in its settings. To run another action (e.g. `!stop` cancels the lottery, `!vote` votes), link a
  **Widget Action** node in front of the widget node (one widget node per Widget Action): its settings pick the action
  and ask for that action's inputs (`vote`: the option and who votes). The widget node waits until the overlay has
  finished playing; after its main action, it adds the widget's output to the data and the flow goes on, after another
  action the flow stops there. Other nodes linked after a Widget Action node get the data as it came in, right away.
- **List settings** (voting and lottery options) are edited row by row: add, remove, move up or down.
  Each lottery option (wheel, slot) has a label, a color and a weight: a bigger weight is a likelier winner.
  The die's six faces are renamed in place (a face labelled 1 to 6 shows as dots); its color and dots color are settings.
  The dice throw is real physics (cannon-es), so it ignores the duration setting: a roll always takes 3.5s.
- **Merge Widgets**: one OBS browser source for several widgets. Link widget nodes into a Merge Widgets node (in the
  library's Widget section); its settings show a 16:9 canvas with a live preview of each one: drag a widget to move it,
  drag its corner to resize it. Boxes snap to the canvas borders, its center lines and the other widgets' edges (hold Alt to place one freely). Its
  link, `http://localhost:6875/m/<workflow>/<node>`, shows them all where they were placed, and follows changes live.
  Placement is relative to the canvas, which scales to fit any browser source size (widgets included) and stays
  centered, so resizing the source in OBS resizes everything. In the flow it only passes data on.
- **Show, hide, cancel**: every widget has these actions. "show" and "hide" fade the whole overlay in or out without
  interrupting what it plays (the alert's own "show" shows a text, and the overlay with it). "cancel" stops its
  animation (the lottery freezes, an alert fades out) and stops the run waiting on it. Cancelling a workflow (switch off, Stop all) cancels the widget actions it is playing.
- **Actions**:
  - run an action on a widget overlay (web source) with its widget node, or a **Widget Action** node in front of it
  - press a key on the broadcaster's machine
  - call an HTTP endpoint
  - pick or search a GIF, a sticker, or a clip (a GIF with sound, for the Video widget; needs a Giphy key approved for clips), on Giphy (**GIPHY**) or a sound on Myinstants (**MyInstants**): they add its URL (`{{gif}}`, `{{sticker}}`, `{{clip}}`, `{{sound}}`) for the Image/GIF and Sound widgets, which only take a file or a URL
  - control software over WebSocket (e.g. OBS)
- **Import/export**: workflows and widgets are plain JSON files.

## Download (no install)

Grab the zip for your OS from the Releases page, unzip it, and double-click **Start Ovrly.command** (macOS) or **Start Ovrly.bat** (Windows). Node is bundled; your data stays in the `data` folder next to it (unzip a new version over the old one to update).

The app is unsigned, so the first launch shows a warning: on macOS right-click the file → Open; on Windows click More info → Run anyway. Pressing keys on macOS needs Accessibility permission (System Settings → Privacy & Security).

Releases are built by `.github/workflows/release.yml` when a `v*` tag is pushed.

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
│  - spin  │   Node graph (workflow)      │ Actions   │
│          │                              │ Widgets   │
│          ├──────────────────────────────┤ (drag &   │
│ Twitch ● │  Settings of the selected    │   drop)   │
│ channel  │  node                        │           │
└──────────┴──────────────────────────────┴───────────┘
```

- **Left**: **Integration** on top: one row each for Twitch, OBS and Giphy; clicking a row opens its settings (Twitch: **Guest** reads any channel's chat with no sign-in, **Streamer** signs in as the channel owner with a code to approve on twitch.tv/activate, for Twitch features; OBS: WebSocket URL and password; Giphy: API key, checked on save) and a status dot (green connected, red not). Below it the workflow list (**+** opens the template picker; the switch next to each name turns a workflow off: what it is running is cancelled and its triggers ignore chat and API calls, while ▶ Run still works; the red **SOS** button below the list turns them all off at once). OBS nodes use that one OBS connection, and their scene and source settings suggest the names from OBS while it is connected.
- **Center**: the node graph of the selected workflow. The toolbar has undo/redo, the name, run manual triggers (▶), then export and delete, then show/hide the library.
- **Right**: the library (workflow only). Drag a node type or a widget type onto the graph. Each widget dropped is a new overlay instance and its widget node, set up from the node's settings: instance ID, name, OBS link, settings and live preview. Deleting the node deletes the instance. Its settings also have the value its main action runs with, when that action takes one.
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

A node with several outputs declares them, e.g. `outputs: ['true', 'false']`, and returns `{ [output]: data }` to pick which ones continue. A trigger sets `event` to the bus event it listens to, or a list of them; `run` gets the one that fired as `event`.

## Writing a widget

Each widget type is a folder in `widgets/`: `widget.js` holds the config defaults and the actions (pure functions that return the new state), and `index.html` renders it.

```js
// widgets/counter/widget.js
export default {
  type: 'counter',
  label: 'Counter',
  config: { title: 'Count' },
  state: { count: 0 },
  actions: {
    add: (state, { value }, config) => ({ count: state.count + Number(value || 1) }),
    reset: () => ({ count: 0 }),
  },
}
```

Actions may be async (e.g. to call the Twitch API), and `on: { 'channel.follow': (state, data, config) => state }` updates a widget's state from bus events, such as Twitch EventSub notifications. `fields` gives settings hints, as for nodes (see `ui/src/Fields.jsx`); a duration lists its usual values, e.g. `duration: { unit: 's', presets: [3, 5, 10] }`, shown as buttons next to an input for any other value.

The page calls `subscribe(({ config, state }) => …)` from `/widgets/lib.js`. A workflow runs a widget's main action (`main`, the type's first action if not set) with its widget node (drag the widget type from the library), and its other actions with Widget Action nodes in front of it. `inputs` says what each action asks for on the node, as node fields: e.g. `{ vote: { option: { vars: true, hint }, user: { vars: true, default: '{{user}}' } } }`, or `{ show: { image: { type: 'image', hint } } }` for a file picker (`image`, `sound` or `video`). The action gets them filled from the data, e.g. `vote(state, { option, user }, config)`; an action not listed asks for nothing. A widget type can also give data back to the workflow: `output(state, config)` returns e.g. `{ winner: 'Red' }`, merged into the data for the next nodes, and `adds: ['winner']` lists those keys for the `{ }` menu. The lottery outputs `winner`, voting `winner`, `votes` and `winners`. The widget node waits until the action has finished playing before the next nodes run. If the widget type knows how long an action plays, it says so with `playTime(action, config)` (ms) and the server waits that long, whether or not an overlay page is open (the lottery and alerts do). An action arriving while another plays cancels it, unless `queues(config, action)` says the type queues them (alerts in some layouts, votes while a vote is open): then both play. `over(state, config)` ends what plays early, as played (a vote closed before its time), and `onCancel` names an action the "cancel" action also runs (Voting: `close`). Otherwise the page reports the end: return a promise from the render function (e.g. `wait(ms)` from `lib.js`) while an animation plays.

## Import / export

Each workflow and widget is a single JSON file in `./data`. Use **Export** to download one, and **Import** (or just drop the file into `./data`) to load one.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
