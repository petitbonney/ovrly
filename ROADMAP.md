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

- [ ] Widget runtime: `/w/:id` page plus WebSocket state updates
- [ ] `widget-update` action node
- [ ] Widget config panel (center pane)
- [ ] Built-ins: alerts → poll → spin wheel → bets → TwitchPlays

## M5: Templates & sharing

- [ ] "New workflow" modal: blank or from a template
- [ ] Starter templates (e.g. `!spin` → wheel, chat poll)
- [ ] Import/export of workflows and widgets as JSON

## Later

- Twitch EventSub (follows, subs, bits, redeems; needs OAuth)
- Other platforms (YouTube, Kick) and software (Streamlabs)
- TypeScript
- Workflow run logs and debugging view
- Custom widget authoring
