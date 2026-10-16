# Agent guide

Ovrly is a local, node-based automation tool for live stream interactions. See [README.md](README.md) for the architecture and [ROADMAP.md](ROADMAP.md) for what's next.

## Principles

- **Simple, short, readable.** Use the fewest lines that stay clear. No clever tricks.
- **Document the why.** Start each file with a one-line header comment saying what it does. Comment only where the code isn't obvious.
- **No premature abstraction.** Write it inline first, and extract only on the third use.
- **Few dependencies.** Ask before adding one.

## Stack

Plain JavaScript (ESM), no TypeScript. pnpm, single package. Express + `ws` on the server; React + ReactFlow + Mantine + Vite for the UI.

## Commands

```bash
pnpm install
pnpm dev      # server + UI on http://localhost:6875
```

## Conventions

- One node type = one file in `server/nodes/`, exporting `{ type, label, category, config, run }`.
- One widget type = one folder in `widgets/`.
- Data lives in `./data` as JSON files (gitignored). Never commit it.
- Scope is Twitch chat and OBS only for now. Don't add other platforms until the roadmap says so.
- Twitch features that need the streamer signed in (Streamer mode) say so: a whole node or widget type with `streamer: true`, one setting option with `{ value, label, streamer: true }` (the UI disables it in Guest mode). On the server, call `needStreamer('Feature name')` from `server/sources/twitch.js` before using them.
- Update `ROADMAP.md` checkboxes when you finish an item.
