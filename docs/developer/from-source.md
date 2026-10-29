# Run from source

You need Node.js 24 or later and pnpm.

```bash
git clone https://github.com/petitbonney/ovrly.git
cd ovrly
pnpm install
pnpm dev      # server + UI on http://localhost:6875
```

`pnpm dev` restarts the server when `server/` changes, and serves the UI through Vite with hot reload. Data goes to `./data`.

## Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` | Server and UI, for development. |
| `pnpm build` | Builds the UI into `dist/`. |
| `pnpm start` | Runs the server on the built UI, as the release does. |
| `pnpm test` | The tests (`node --test test/*.test.js`). |
| `pnpm streamdeck:pack` | Packs the Stream Deck plugin into `streamdeck/com.ovrly.deck.streamDeckPlugin`. |
| `pnpm streamdeck:link` | Links the plugin folder into the Stream Deck app, to develop it. |
| `pnpm docs:dev` | This site, with hot reload. |
| `pnpm docs:build` | Builds this site into `docs/.vitepress/dist/`. |
| `pnpm docs:shots` | Takes this site's screenshots (needs Docker). |

## Tests

Tests use Node's own runner, no framework. Each test file runs in a fresh temp folder (`process.chdir` to a `mkdtemp`), so `./data` is never touched.

## Releases

Pushing a `v*` tag runs `.github/workflows/release.yml`: on macOS (arm64, x64) and Windows, it builds the UI, packs the Stream Deck plugin, installs production dependencies flat, adds a Node binary and the launchers from `release/`, and attaches one zip per OS to a GitHub release.

## Docs

This site lives in `docs/`, one Markdown file per page; `docs/.vitepress/config.js` has the sidebars. Pushing to `master` publishes it to GitHub Pages (`.github/workflows/docs.yml`).

Screenshots are never taken by hand: `pnpm docs:shots` builds the UI, then runs `docs/screenshots/take.js` in the Playwright Docker image. It starts Ovrly on empty data in a temp folder (port 6876), makes workflows from the templates through the editor, and saves PNGs into `docs/public/screenshots/`. Run it again after a UI change, and commit the new images. To add one, add a step to `take.js` and reference `/screenshots/<name>.png` in a page.
