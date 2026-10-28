# Ovrly

> Node-based automation for live stream interactions.

Ovrly lets you connect stream events (Twitch chat) to actions (overlays, key presses, HTTP calls, OBS) by drawing a graph, the way n8n works, but for streamers.

**Status:** prototype. JavaScript only, Twitch chat only, OBS only.

## Features

- **Workflows**: node graphs of the form trigger → logic → action. Build one from scratch or start from a template.
- **Widgets**: built-in browser-source overlays: alerts, label (a text that stays on screen until changed or stopped, in any [Google Fonts](https://fonts.google.com) family, searched by name; the overlay loads it, so it needs internet), image/GIF, sound, video, voting, lottery, roulette, dice roll, TwitchPlays. The sound widget plays a sound through its overlay (so it reaches the stream; tick "Control audio via OBS" on the browser source): a file on disk (Browse files), a search on [Myinstants](https://www.myinstants.com) (no API: Ovrly reads its search pages, for personal use), or a URL, e.g. `{{sound}}` from a previous node. Its max duration cuts it with a short fade-out (0 plays all of it) and its volume is a percentage. The video widget plays a short video the same way (a file on disk, mp4 or webm, or a URL; max duration and volume; it fades out at the end). The image/GIF widget shows the image set on its node: a file on disk (picked with Browse files, used where it is), a GIF picked from Giphy (once the Giphy integration has an API key), or a URL, e.g. `{{image}}` from a previous node; it fades in and out. The lottery draws a winner with a
  wheel (weighted options colored by a palette) or a slot (one reel), its options typed in or added by the workflow
  (load, loadAll; clear removes them all), and keeps the winner shown until reset or the next draw; the roulette draws a number from 0 to 36; the dice roll rolls
  a die with six faces of its own.
  Alerts show a text with one of ten layouts: banner, neon sign, ticket, speech bubble, arcade, flap board, trophy
  (three.js), sticky note, marquee or particles. A new alert replaces the one showing, except on the ticket, flap board
  and marquee (queued, one after another) and sticky notes (stacked); the workflow waits until its own alert has gone.
  Most layouts play sounds, made in the page (no files), at a volume setting (0 mutes them).
- **Voting**: a poll (the most voted option leads) or a prediction (viewers bet, then "win" reveals who guessed right),
  open for its duration after "start", or until "stop". Its widget node keeps firing until voting ends, then outputs
  the result; "cancel" (or cancelling the workflow) closes the vote too, and nothing goes on. In Chat mode, viewers vote through the "vote" action (`!vote 2`,
  `!vote red`), one vote per viewer, in Guest or Streamer mode. Twitch mode (Streamer mode, the default once signed in)
  runs a native Twitch poll or prediction (channel points; Twitch Affiliates and Partners only), with live results over
  EventSub. It outputs `winner`, `votes` and `winners` (who bet right).
- **TwitchPlays**: translates chat into keys, through a list of command → keys pairs (`up` → `Up`); a Key Press node
  set to `{{keys}}` presses them. "start" (its Start button, or a Widget Action) makes it listen; its widget node runs
  "push" with each chat message. Anarchy passes on every command at once; democracy counts one vote per viewer in
  loops of the vote window, counted from "start", and passes on each loop's winner when it ends. "stop" and "cancel"
  stop listening (stop passes on the winner of the loop under way; cancel drops it and resets the log and votes). Widget Action's `mode` action
  switches modes until stop or cancel (dropping a vote under way). Key Press's "Only when focused" presses only while that app or window is focused, picked from those
  open (macOS: window titles need the Accessibility permission Key Press already needs).
- **Twitch features**: in Streamer mode, the Voting widget can run a native Twitch poll or prediction. Twitch triggers (follow, subscription, gift subs, cheer, channel points, raids, stream online/offline, hype train) follow EventSub in Streamer mode; subs, gift subs, cheers and raids also work in Guest mode, from what chat announces. Twitch actions (Streamer mode) send chat messages and replies, announcements and shoutouts, time out, ban or delete messages, change the title, category, tags and chat modes, run ads, make clips and stream markers, raid, look up a viewer (follow age, sub tier), and manage channel points rewards and redemptions (Twitch only lets Ovrly change rewards it made: the Channel Points Reward node makes them).
- **Stream Deck**: the Ovrly plugin (Stream Deck app 7.1+; download it from Settings → Stream Deck, then open it) adds an **Ovrly button** action. Drop it on a key and pick a button of a Control Pad node (mode: Stream Deck) in its settings: the key shows the button's icon, name and color (drawn by Ovrly, faded while its workflow is off), follows its changes live, and fires it (✓ when it ran, ⚠ when the workflow is off or Ovrly isn't running). The node's grid marks the buttons on a key, with where they are.
- **Philips Hue**: pair the bridge in Settings → Philips Hue (its IP, then press the bridge's button and Pair). The Hue Lights node picks a light, room or zone and a mode: **toggle**, **set** (turns on with a brightness and color), **off**, each one command with a fade (transition), or **routine**: a list of steps (set a color and brightness, or off, each for a duration), played once, N times or until stopped, then the lights are put back as they were (unless unticked). The node runs until the routine ends; its settings have **Stop** (fades back, the workflow goes on) and **Cancel** (back at once, the workflow stops there; so does the workflow's cancel), and firing it again on the same device replaces the routine. Guardrails: steps last at least 200ms on a light (under 3 flashes a second) and 1s on a room or zone, at most 50 steps, commands paced for the bridge; the editor warns about steps they change.
- **Multiple instances**: run several widgets and workflows side by side.
- **Triggers**: a schedule, Twitch chat (any message or a `!command`), an API call to `http://localhost:6875/hooks/<path>` (query and JSON body become data), a Control Pad button (the Control Pad node: a list of buttons, each with a name, icon and color and its own output; its mode picks how they fire: **Companion**, a URL per button, `/hooks/<path>/<name>-<id>`, to copy for Companion or anything that sends HTTP, where only the id counts, so renaming keeps old URLs working, or **Stream Deck**, keys paired with the Ovrly plugin (see below; a new node starts on it while the plugin is connected, and it can't be picked while it isn't); each fires its own way only; its settings show the buttons as a grid to press, which fire nothing while the workflow is off), or the Run button in the editor (Manual Trigger).
- **Logic**: filter (continues only if a comparison holds, like if/else; 13 operators: equals, contains, regex, numbers, empty…), delay (in seconds), if/else, switch (a list
  of cases, one output each, labelled by the case; links follow their case when cases move or are removed), wait for all (continues once every incoming link has delivered, from any firing, e.g. two triggers; its settings show which links have, Force to continue now and Cancel to drop what arrived),
  cooldown (lets data through, then sends the next to "blocked" for a while, for everyone and optionally per data key),
  fan out (what follows runs once per item of a list, e.g. a gift's recipients), fan in (collects firings into one
  `{{items}}` list with `{{count}}`, released after a duration, a quiet period or a limit of entries, whichever comes
  first; optionally one entry per key, keeping the first or last, e.g. `!join` sign-ups for a giveaway) and queue (what follows runs one firing at a time, the next wait in line; its settings show the line, and remove a firing from it).
- **Expressions**: any text setting takes `{{ ... }}`: a path (`{{user}}`, `{{json.items.0.name}}`, `{{$vars.score}}`,
  `{{$node.http-request.status}}` for the output of an earlier node, by type or id) or a JavaScript expression
  (`{{ score * 2 }}`). Expressions and the Code node run as code: only import workflows you trust.
- **Data vs variables**: *data* is the payload that travels from node to node during one run (`{{user}}`), gone when
  the run ends. *Variables* are shared by all workflows and kept across runs and restarts (`{{$vars.score}}`).
  Edit Data changes data, Map Value swaps a key's value through a "from" → "to" list; Edit Variable sets, adds to or deletes a variable.
- **More nodes**: Code (JavaScript on the data), Schedule (a trigger every N minutes),
  Execute Workflow (runs another workflow from one of its Called By Workflow triggers, picked by its ID, and merges its result in).
- **Custom nodes and widgets**: node and widget types of your own, in `data/custom/` (see [Custom nodes](#custom-nodes)
  and [Custom widgets](#custom-widgets)). Settings → Custom nodes and Custom widgets list them and their errors,
  import a node file or a widget folder, start a new widget from a working example, reload and open the folder; a
  changed file reloads by itself (and so do the widget's pages in OBS). They run as Ovrly does, with full access to
  your computer: only add files you trust.
- **Errors and history**: a node that fails stops the firing there. An Error Trigger workflow runs when a node fails
  in another one. `GET /api/runs` has the last 100 firings (in memory), with each node's input and output.
- **Widget concurrency**: starting a widget that is still playing (e.g. a second `!spin`) replaces what plays; the
  replaced run stops there. Put a queue node before the widget to play them in turn instead.
- **Widgets in a workflow**: a widget node is its own overlay instance (with its own OBS link), run in the flow like
  any node: it runs its widget's **start** action (TwitchPlays: push) with the inputs set in its settings, keeps firing
  until the widget has stopped, then adds the widget's output to the data and the flow goes on. A widget's settings,
  inputs and kept data (e.g. the lottery's options added by the workflow) are saved in `data/widgets/<id>.json`; what plays
  (a draw, a vote under way) is in memory, and lost on restart. A pasted widget node is a new instance with a copy of
  those settings. To run another action (e.g. `!stop` stops
  the lottery, `!vote` votes), link a **Widget Action** node in front of the widget node (one widget node per Widget
  Action): its settings pick the action (stop by default) and ask for that action's inputs (`vote`: the option and who
  votes); the flow stops at the widget node. Other nodes linked after a Widget Action node get the data as it came in,
  right away. The ⓘ next to a widget node's name lists its actions, with what they do and the inputs they ask for, as
  its settings allow them (e.g. Voting's `win` only for a prediction).
- **List settings** (voting and lottery options) are edited row by row: add, remove, move up or down.
  Each lottery option (wheel, slot) has a label, a color and a weight: a bigger weight is a likelier winner.
  The die's six faces are renamed in place (a face labelled 1 to 6 shows as dots); its color and dots color are settings.
  The dice throw is real physics (cannon-es), so it has no duration setting: a roll always takes 3.5s.
- **Merge Widgets**: one OBS browser source for several widgets. Link widget nodes into a Merge Widgets node (in the
  library's Widget section); its settings show a 16:9 canvas with a live preview of each one: drag a widget to move it,
  drag its corner to resize it. Boxes snap to the canvas borders, its center lines and the other widgets' edges (hold Alt to place one freely). Its
  link, `http://localhost:6875/m/<workflow>/<node>`, shows them all where they were placed, and follows changes live.
  Placement is relative to the canvas, which scales to fit any browser source size (widgets included) and stays
  centered, so resizing the source in OBS resizes everything. In the flow it only passes data on.
- **Start, stop, cancel**: every widget has these actions, also as buttons under its preview (named after the actions
  its type binds to them); with more actions, Start is a split button listing them, and one that asks for inputs opens
  a dialog that remembers them. "start" plays it (a
  draw, an alert, a vote…); its run keeps firing until the widget stops. A widget stops by itself when it is over, or
  with "stop", which ends it properly (the lottery jumps to its winner, an alert fades out, a vote closes) and lets the
  workflow that started it go on with the result. "cancel" cuts it (the lottery freezes, an alert disappears) and the
  workflow that started it stops there. Cancelling a workflow (its Cancel button, switching it off, SOS) cancels the
  widgets it is playing.
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
┌──────────┬────────────────────────────────┬───────────┐
│Workflows+│ ↶↷ name ▶■ │ ⤓ 🗑 │ ◫         │ Triggers  │
│  - !spin │                                │ Logic     │
│  - spin  │   Node graph (workflow)        │ Actions   │
│   SOS    │                                │ Widgets   │
│          ├────────────────────────────────┤ (drag &   │
│          │  Settings of the selected node │   drop)   │
│Settings !│  (settings │ live column)      │           │
└──────────┴────────────────────────────────┴───────────┘
```

- **Left**: the workflow list (**+** opens the new workflow picker; the switch next to each name turns a workflow off: what it is running is cancelled and its triggers ignore chat and API calls, while ▶ Run still works). The red **SOS** button below it turns them all off at once, then offers to turn them back on. Below, one row per integration set up (connected ✓ or failing !, its tooltip says more), opening its settings; those not set up are only in Settings. The dialog has the integrations, each with its status (✓ connected, ! failing, a dashed circle when not set up) (Twitch: **Guest** reads any channel's chat with no sign-in, **Streamer** signs in as the channel owner with a code to approve on twitch.tv/activate, for Twitch features, and reads the Guest channel's chat until signed in; OBS: WebSocket URL and password; Stream Deck: the plugin to download, its devices and paired keys; Hue: pairing; Giphy: API key, checked on save), **LAN**, and **Theme** (Ovrly's own, or an IDE palette: Dracula, Tokyo Night, Nord, Catppuccin, Gruvbox, One Dark Pro, Monokai, Solarized Dark, GitHub Light, One Light or Catppuccin Latte; kept by this browser; overlays keep their own look). OBS nodes use that one OBS connection, and their scene and source settings suggest the names from OBS while it is connected.
- **Center**: the node graph of the selected workflow (an empty one says how to start). The toolbar has undo/redo, the name, run manual triggers (▶) and stop the workflow (■, cancels its running nodes), then export and delete, then show/hide the library. The bolt beside a Manual Trigger runs it; beside a chat trigger, it sends a test message from TestViewer (with the trigger's command), to try a workflow without going live.
- **Right**: the library (workflow only; hidden at first in a narrow window). Drag a node type or a widget type onto the graph, or double-click it (or press Enter on it): it is added after the selected node and linked from it. The new node is selected, which opens its settings. A node type whose integration isn't ready shows a plug icon, as do such nodes on the graph. Each widget dropped is a new overlay instance and its widget node. Deleting the node deletes the instance.
- **Copy/paste**: Ctrl/⌘+C and Ctrl/⌘+V copy the selected nodes, also into another workflow. Pasted widget nodes share the same instance (once per workflow); it is deleted once no workflow uses it anymore. Each instance has its own id, shown in its node's settings with a button that copies the node.
- **Undo/redo**: Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y), or the toolbar arrows. Undoing a widget node's deletion brings its instance back too.
- **Bottom**: settings of the selected node (workflow only; each workflow remembers which node was open, and the graph stays centered as the pane opens; × or Escape closes them), laid out the same for every node: notices (what it needs that isn't ready, with a link to its settings, or its last error), the settings column, and a live column when the node has something to watch or press (a widget's OBS link, preview and Start/Stop/Cancel; a Control Pad's buttons; a Queue's line; a Code node's Test, on its last input; a Hue routine's Stop/Cancel). A widget node's settings have **This node** (the inputs of the action it runs) and **Widget (shared)** (name, settings, shared by every node using it), then its instance ID. Pickers for options and a **{ }** menu insert data from previous nodes, e.g. `{{user}}`. Changes save by themselves; if Ovrly can't be reached, the editor says so and tries again until it can.
- **Live feedback**: while a workflow runs, its graph shows it: a running node pulses blue, a finished one flashes green, one that stopped the flow (e.g. a filter that didn't match) dims, a failing one turns red and stays so until it runs again (its settings show the error, also after a reload), and links carrying data animate.
- **Graph controls** (top left): zoom, fit view, lock (nodes can't be moved, linked or deleted, but still open their settings), and arrange: a one-shot left-to-right layout (one undo step; nodes stay movable).
- Drag the edge of the right and bottom panes to resize them.
- **Developer mode**: Ctrl+Shift+D (Ctrl on macOS too) shows a tool button at the bottom right that opens `/api/events`: the last 200 events, each tagged with the channel it travelled on: `bus` (chat, API hooks, `/api/emit`), `http` (manual runs, HTTP request nodes), `websocket` (WebSocket send nodes, OBS, the Twitch connection) `sse` (widget actions sent to overlays, and their end with the output) and `log` (Log nodes). A live table in a browser, JSON otherwise (or with `?format=json`).

## How it works

```
Twitch chat,
Stream Deck ──► Event bus ──► Workflow engine ──► Actions
                                                    ├─ Widget (SSE → browser source)
                                                    ├─ Key Press (nut.js)
                                                    ├─ HTTP Request
                                                    ├─ WebSocket client (OBS)
                                                    └─ Hue bridge (HTTPS, local)
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
| Philips Hue | the bridge's local API (CLIP v2), its certificate pinned at pairing |
| Stream Deck | plugin on the Stream Deck SDK's WebSocket protocol, packed with @elgato/cli |
| Key Press | @nut-tree/nut-js              |
| Storage   | JSON files in `./data`        |

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
streamdeck/       the Ovrly Stream Deck plugin (com.ovrly.deck.sdPlugin; pnpm streamdeck:pack, pnpm streamdeck:link to develop)
test/             node --test (pnpm test)
data/             your widgets, workflows and custom/ node and widget types (gitignored)
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

Optional metadata makes the settings pane friendlier: `description`, `adds` (the data keys the node adds, offered as `{{key}}` in later nodes) and `fields` (per-setting hints such as `{ options: [...] }`, `{ vars: true }` for `{{key}}` placeholders, `{ type: 'json' }`, a short `hint` or a longer `info`, or a `section` heading; see `ui/src/Fields.jsx`, and AGENTS.md for how to lay them out).

A node with several outputs declares them, e.g. `outputs: ['true', 'false']`, and returns `{ [output]: data }` to pick which ones continue. A trigger sets `event` to the bus event it listens to, or a list of them; `run` gets the one that fired as `event`.

### Custom nodes

A custom node is written the same way, in `data/custom/nodes/<name>.js` (or imported from Settings → Custom nodes). It can't
take a built-in type, goes to the library's **Custom** group unless it names its own `group`, and needs `type`,
`label`, `category` (`trigger`, `logic` or `action`) and `run`. Instead of importing Ovrly's files, `run` gets
`ovrly`: `fill(text, data)` (and `fillJson`, `fillUrl`, `value`, `list`, see `server/template.js`), `vars` and
`saveVars()`, `log(event, data)` (the events view), `twitch.helix(method, path, body, query)`, `twitch.userId()`,
`twitch.needStreamer(feature)` and `obs.request(type, data)`.

```js
// data/custom/nodes/dice-total.js
export default {
  type: 'dice-total',
  label: 'Dice Total',
  icon: 'dice-5',
  category: 'logic',
  description: 'Rolls some dice and adds them up.',
  config: { dice: 2, faces: 6 },
  fields: { faces: { hint: 'Per die' } },
  run({ config, data, ovrly }) {
    const rolls = Array.from({ length: config.dice }, () => 1 + Math.floor(Math.random() * config.faces))
    ovrly.log('dice-total', rolls)
    return { ...data, rolls, total: rolls.reduce((a, b) => a + b, 0) }
  },
}
```

A workflow that uses a custom node that isn't loaded (removed, broken, or not yet copied to this computer) shows it in
red, and a firing that reaches it fails there.

## Writing a widget

Each widget type is a folder in `widgets/`: `widget.js` declares its settings and actions (run on the server), and
`index.html` is the overlay page that shows it.

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

**Actions.** Each is `{ description, inputs, only, run }`. `run({ state, runtime, input })` returns the parts it
changes, `{ state?, runtime? }` (nothing: it did nothing); it may be async (e.g. a Twitch call), and throwing refuses
the action. `inputs` says what it asks for on the node, as node fields, filled from the data when it runs: e.g.
`{ option: { vars: true, hint }, user: { vars: true, default: '{{user}}' } }`, `{ image: { type: 'image' } }` for a
file picker (`image`, `sound` or `video`), or `{ type: 'list' }` for a list (its own items, or a data key's). `only`
shows an action only with some settings, as for fields (Voting's `vote`: `{ mode: 'chat' }`). `description` and
`inputs` are listed in the node's ⓘ tooltip. A state also holds `name` (the widget's) and `input` (the inputs set on
its node), filled in by Ovrly.

**Running in a workflow.** The widget node runs its `start` action, or the one named by `onSignal` (TwitchPlays:
`'push'`); Widget Action nodes in front of it run the others. Every type has `stop` (ends what plays, the workflow goes
on) and `cancel` (cuts it, the workflow stops there): give them a `run` to do more (Voting closes the vote), or bind
other actions with `onStart`, `onStop` and `onCancel` (the lottery's `onCancel: 'reset'`). The node waits until what
it started has stopped:

- `playTime(action, { state, runtime })` (ms) says how long an action plays, and the server waits that long, page open
  or not (alerts, the draw widgets); 0 goes on at once. Without it, the page reports the end: its render returns a
  promise (e.g. `wait(ms)` from `lib.js`), and with no page open it goes on at once.
- `stopTime({ state, runtime })` (ms, 0 by default): after "stop", the workflow goes on once the outro has played.
- An action arriving while another plays replaces it (that run stops there), unless `queues(action, snap)` says so
  (alerts in some layouts, votes while a vote is open): then both play. `over(snap)` ends what plays early, as stopped
  (a vote closed on Twitch).
- `output({ state, runtime })` gives data back to the workflow once it has stopped, e.g. `{ winner: 'Red' }`, and
  `adds: ['winner']` lists those keys for the `{ }` menu. The lottery, roulette and dice roll output `winner` (they
  share `widgets/draw.js`, and `draw-page.js` for their pages), Voting `winner`, `votes` and `winners`.
- `on: { 'channel.poll.progress': (snap, data) => ({ runtime }) }` updates its widgets from bus events, such as Twitch
  EventSub notifications.

**The page.** It calls `subscribe(({ state, runtime }) => …, { stop, cancel })` from `/widgets/lib.js`, now and on
every update. When "stop" or "cancel" ends what plays, its handler runs instead (play an outro, or cut); a page
without one renders the new state. Once something has ended, `runtime.ended` is set, so a page opened later doesn't
replay it; `runtime.firing` says whether a run still plays. Text from chat goes in with `el()` from `lib.js` or
`textContent`, never as HTML. Shared code (e.g. a fade's duration) is imported from `/widgets/<type>/widget.js`, and
the animation libraries from `/vendor/` (see `widgets/dice/index.html` for the import map).

### Custom widgets

A custom widget is a folder in `data/custom/widgets/`, named as its type, written like the built-in ones: `widget.js`
(a `start` action at least) and `index.html`, plus any file the page uses (styles, scripts, images, fonts, sounds,
videos). Its files are served at `/widgets/<type>/`, as the built-in ones, so the page uses `/widgets/lib.js`,
`/widgets/base.css` and the `/vendor/` libraries the same way. Its actions get `ovrly` (see [Custom nodes](#custom-nodes)),
as do its `on` handlers (third argument). **New widget…** in Settings → Custom widgets makes a working one to start
from (a text shown for a few seconds); the built-in widgets in `widgets/` show the rest.

When a custom widget changes, what plays on its widgets stops there, they get its new settings' defaults and their
pages reload. A widget node whose type isn't loaded keeps its settings and shows in red until the type is back.

### Packages in custom code

Custom code has Node's built-ins (`node:fs`, `node:crypto`…) and `fetch`, but no npm installs (the download bundles
Node without npm). To use a package:

- **Copy its ESM build** next to your code and import it by a relative path. A node's own files go in a subfolder,
  e.g. `data/custom/nodes/lib/` (only the `.js` files directly in `nodes/` are nodes); a widget's anywhere in its
  folder.
- **Or bundle** your code and its packages into one file, e.g.
  `npx esbuild src/my-node.js --bundle --platform=node --format=esm --outfile=data/custom/nodes/my-node.js`.
- **In a page**, map it in the import map: to the `/vendor/` libraries (anime.js, three.js, cannon-es), to a file in
  the widget's folder (`/widgets/<type>/lib/confetti.js`), or to a CDN with a pinned version
  (`https://esm.sh/canvas-confetti@1.9.3`). A CDN needs internet when OBS loads the page: prefer a copied file.

Ovrly's own packages are within reach (imports look up to its `node_modules`), but they aren't for custom code: Ovrly
may upgrade or drop them. Use the `ovrly` helpers, `/vendor/` in pages, or a copy of your own. Only a node's file and a
widget's `widget.js` reload when changed; the files they import reload on a restart.

## Import / export

Each workflow and widget is a single JSON file in `./data`. Use **Export** to download one, and **Import** (or just drop the file into `./data`) to load one.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
