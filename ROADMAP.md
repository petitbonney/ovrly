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
- [x] Built-ins: alerts → poll → spin wheel → bets → TwitchPlays

## M5: Templates & sharing

- [x] "New workflow" modal: blank or from a template
- [x] Starter templates (e.g. `!spin` → wheel, chat poll)
- [x] Import/export of workflows and widgets as JSON

## M6: More nodes

- [x] Triggers: API call (`/hooks/<path>`), manual (Run button)
- [x] Logic: if/else, switch, wait for all (multi-output nodes and joins in the engine)
- [x] Logic: cooldown (global or per viewer) and queue; widget actions cancel and restart the one still playing
- [x] Widget nodes (the "what") linked by diamond connectors to Fire Widget action nodes (the "how")

## M7: Editor polish

- [x] Settings pane with option pickers, key picker, JSON editor and `{key}` insertion from upstream nodes
- [x] Widgets in the library: dropping a widget type creates an instance (own id), set up in its node's settings
- [x] Undo/redo of graph edits (buttons and shortcuts)
- [x] Copy/paste nodes across workflows, with feedback; pasted widget nodes share their instance (once per workflow), deleted with its last node
- [x] Twitch connection in the sidebar, chat test in chat triggers' settings

## Later

- Twitch EventSub (follows, subs, bits, redeems; needs OAuth)
- Other platforms (YouTube, Kick) and software (Streamlabs)
- TypeScript
- Workflow run logs and debugging view
- Custom widget authoring
