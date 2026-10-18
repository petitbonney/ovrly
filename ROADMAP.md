# Roadmap

Small steps; each milestone should be usable on its own.

## M0: Skeleton

- [x] Single package: Express server + Vite React UI, `pnpm dev` runs both
- [x] `store.js`: CRUD on JSON files in `./data`
- [x] Event bus (`EventEmitter`)
- [x] Three-pane UI shell (left lists, center, right, bottom)

## M1: Workflows

- [x] ReactFlow graph: add, connect and delete nodes; save to JSON
- [x] Node library pane with drag & drop
- [x] Node config pane generated from each node's `config` defaults
- [x] Engine: trigger → walk edges → run nodes, passing `data`
- [x] Core nodes: `chat-message` (trigger), `filter`, `delay`, `log`

## M2: Twitch chat

- [x] tmi.js connection (channel name in settings, anonymous read)
- [x] Triggers: chat message, `!command`
- [x] Chat test panel to fire fake events without going live

## M3: Actions

- [x] `http-request`
- [x] `websocket-send` (generic)
- [x] `obs-scene`, `obs-source` (switch scene, toggle source) via obs-websocket v5
- [x] `key-press` via nut.js

## M4: Widgets

- [x] Widget runtime: `/w/:id` page plus live state updates (SSE)
- [x] `widget-update` action node
- [x] Widget config panel (center pane)
- [x] Built-ins: alerts → poll → lottery → bets → TwitchPlays

## M5: Templates & sharing

- [x] "New workflow" modal: blank or from a template
- [x] Starter templates (e.g. `!spin` → lottery, chat poll)
- [x] Import/export of workflows and widgets as JSON

## M6: More nodes

- [x] Triggers: API call (`/hooks/<path>`), manual (Run button)
- [x] Logic: if/else, switch, wait for all (multi-output nodes and joins in the engine)
- [x] Logic: cooldown (global or per viewer) and queue; widget actions cancel and restart the one still playing
- [x] Widget nodes run their widget's main action in the flow; Widget Callback nodes run any action on a widget node of the same workflow

## M7: Editor polish

- [x] Settings pane with option pickers, key picker, JSON editor and `{{key}}` insertion from upstream nodes
- [x] Widgets in the library: dropping a widget type creates an instance (own id), set up in its node's settings
- [x] Undo/redo of graph edits (buttons and shortcuts)
- [x] Copy/paste nodes across workflows, with feedback; pasted widget nodes share their instance (once per workflow), deleted with its last node
- [x] Twitch connection in the sidebar, chat test in chat triggers' settings
- [x] Twitch Guest/Streamer modes (Device Code sign-in, EventSub over WebSocket); Twitch poll and prediction modes in Poll and Bets

## M8: Engine

- [x] Expressions: `{{ path }}` and `{{ js }}`, earlier nodes' outputs (`$node`), variables (`$vars`)
- [x] Edit Data, Edit Variable and Code nodes; more comparison operators; HTTP headers and parsed JSON response
- [x] Schedule trigger
- [x] Per-node retries and continue-on-error, Error Trigger
- [x] Run history: `GET /api/runs`, last input and output in each node's settings
- [x] Execute Workflow with a Called By Workflow trigger

## Later

- Twitch EventSub triggers (follows, subs, bits, redeems; Streamer mode)
- Other platforms (YouTube, Kick) and software (Streamlabs)
- TypeScript
- Run history that survives restarts, and a view of all runs
- Loop over lists (items) and Merge modes
- Custom widget authoring
