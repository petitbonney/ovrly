# Agent guide

Ovrly is a local, node-based automation tool for live stream interactions. See [README.md](README.md) for the architecture.

## Principles

- **Simple, short, readable.** Use the fewest lines that stay clear. No clever tricks.
- **Document the why.** Start each file with a one-line header comment saying what it does. Comment only where the code isn't obvious.
- **No premature abstraction.** Write it inline first, and extract only on the third use.

## Stack

Plain JavaScript (ESM), no TypeScript. pnpm, single package. Express + `ws` on the server; React + ReactFlow + Mantine + Vite for the UI.

**Motion: anime.js (v4) is the animation standard** for the whole app, widget pages and UI alike. 3D goes through three.js, animated with anime.js's Three.js adapter (`animejs/adapters/three`); physics (the dice throw) through cannon-es, replayed with anime.js. Widget pages load them from `/vendor/` (see `widgets/lottery/index.html` for the import map).

## Commands

```bash
pnpm install
pnpm dev      # server + UI on http://localhost:6875
```

## Conventions

- One node type = one file in `server/nodes/`, exporting `{ type, label, category, group, config, run }` (`group` is its sub-section in the library).
- One widget type = one folder in `widgets/`.
- Data lives in `./data` as JSON files (gitignored). Never commit it.
- Scope: Twitch and OBS, plus the Stream Deck as a controller (its plugin is in `streamdeck/`) and Philips Hue lights. Ask before adding another platform.
- Twitch features that need the streamer signed in (Streamer mode) say so: a whole node or widget type with `needs: ['twitch']` (`needs` lists requirement keys: `twitch`, `obs`, `streamdeck`, `giphy`, `hue`, or `chat` for the Twitch chat in either mode; the UI marks the ones not ready in the library and on the graph, and notes them in the node's settings), one setting option with `{ value, label, streamer: true }` (the UI disables it in Guest mode). An option can also need an integration while picked: `{ value, label, needs: 'streamdeck' }`. On the server, call `needStreamer('Feature name')` from `server/sources/twitch.js` before using them.
- Errors and hints that point to a setting name its place as `Settings → Twitch` (the Settings dialog's pane).

## Node settings layout

Every node's settings pane has the same layout (`Config` in `ui/src/Workflow.jsx`, fields in `ui/src/Fields.jsx`): header (icon, name, close), one-line description, notices (`Notice.jsx`: yellow when something won't run yet, red when broken, linking to the Settings pane that fixes it), then a settings column (420px at most, on the left even when nothing is beside it) and, only when the node has something to watch or press, a live column on its right (widget preview and Start/Stop/Cancel, Control Pad buttons, Queue line, Hue routine Stop/Cancel). Widget nodes split their settings in two sections: **This node** (the action's inputs) and **Widget (shared)**.

When writing a node or widget type's `config` and `fields`:

- **Order** is the `config` order: the main choice first (a mode or action that changes which other settings show), then what it acts on, then details, timing, and extra options last.
- **Sections** (`section: 'Title'` on a group's first field) only for more than about 5 visible settings.
- **Labels** in sentence case. A humanized key is fine when it reads well (`minBits` → "Min bits"); plain-text options show with a capital first letter, so give `{ value, label }` only when that isn't enough (`GIF`). Units go in `unit` (shown in the field), not in the label.
- **Hints** (`hint`) are one short line; anything longer goes in `info` (an ⓘ beside the label).
- A setting shown only while a switch is on (`only: { someSwitch: true }`) is indented under it, by itself.
