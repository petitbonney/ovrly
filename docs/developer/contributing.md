# Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/petitbonney/ovrly). [AGENTS.md](https://github.com/petitbonney/ovrly/blob/master/AGENTS.md) holds the conventions, for people and coding agents alike; the gist:

## Principles

- **Simple, short, readable.** The fewest lines that stay clear. No clever tricks.
- **Document the why.** Each file starts with a one-line comment saying what it does. Comment only where the code isn't obvious.
- **No premature abstraction.** Write it inline first; extract on the third use.

## Conventions

- Plain JavaScript (ESM), no TypeScript. pnpm, one package.
- One node type = one file in `server/nodes/`; one widget type = one folder in `widgets/`.
- anime.js is the animation standard, for widget pages and the UI alike.
- `./data` is the user's: never commit it.
- Scope: Twitch and OBS, the Stream Deck as a controller, Philips Hue. Open an issue before adding another platform.

## Before a pull request

```bash
pnpm test
pnpm docs:build
```

If you changed the UI, run `pnpm docs:shots` and commit the new screenshots (see [Run from source](./from-source#docs)). If you changed what a streamer sees, update the matching page in `docs/streamer/`.
