# Agent guide

Ovrly is a local, node-based automation tool for live stream interactions. See [README.md](README.md) for the architecture and [ROADMAP.md](ROADMAP.md) for what's next.

## Principles

- **Simple, short, readable.** Use the fewest lines that stay clear. No clever tricks.
- **Document the why.** Start each file with a one-line header comment saying what it does. Comment only where the code isn't obvious.
- **No premature abstraction.** Write it inline first, and extract only on the third use.
- **Few dependencies.** Ask before adding one.

## Stack

Plain JavaScript (ESM), no TypeScript. pnpm, single package. Express + `ws` on the server; React + ReactFlow + Vite for the UI.

## Commands

```bash
pnpm install
pnpm dev      # server + UI on http://localhost:3000
```

## Conventions

- One node type = one file in `server/nodes/`, exporting `{ type, label, category, config, run }`.
- One widget type = one folder in `widgets/`.
- Data lives in `./data` as JSON files (gitignored). Never commit it.
- Scope is Twitch chat and OBS only for now. Don't add other platforms until the roadmap says so.
- Update `ROADMAP.md` checkboxes when you finish an item.
