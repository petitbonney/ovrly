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
| `pnpm start` | Runs the server on the built UI, as the desktop app does. |
| `pnpm desktop` | Builds the UI and opens the desktop app (Electron) on it, with data in `./data`. |
| `pnpm desktop:build` | Builds this OS's installer into `release/` (add e.g. `--mac --x64` for another architecture). |
| `pnpm test` | The tests (`node --test test/*.test.js`). |
| `pnpm streamdeck:pack` | Packs the Stream Deck plugin into `streamdeck/com.ovrly.deck.streamDeckPlugin`. |
| `pnpm streamdeck:link` | Links the plugin folder into the Stream Deck app, to develop it. |
| `pnpm docs:dev` | This site, with hot reload. |
| `pnpm docs:build` | Builds this site into `docs/.vitepress/dist/`. |
| `pnpm docs:shots` | Takes this site's screenshots (needs Docker). |

## Tests

Tests use Node's own runner, no framework. Each test file runs in a fresh temp folder (`process.chdir` to a `mkdtemp`), so `./data` is never touched.

## Releases

Versions are calendar ones, `YYYY.M.MICRO`: `2026.11.0`, then `2026.11.1` for the next release that month, and `2026.12.0` for the first of the next. No leading zeros, as electron-builder needs valid semver. The tag is the only place a version lives: `package.json` stays at `0.0.0-dev`.

To release, tag `master` and push the tag, never moving it afterwards:

```bash
git tag -a v2026.11.0 -m v2026.11.0
git push origin v2026.11.0
```

This runs `.github/workflows/release.yml`: on macOS (arm64, x64) and Windows, it runs `pnpm desktop:build` with the tag as version (the Stream Deck plugin's too), and attaches the two `.dmg`s and the Windows installer to a GitHub release, its notes listing the commits since the previous tag. A breaking change to saved data or the custom code API gets a line of its own there: the version doesn't show it.

## Desktop app

`desktop/main.js` is the Electron entry. It runs the server in Electron's main process (packaged, with `OVRLY_DATA` set to the user's data folder), shows the editor at `localhost:6875` in a window, and keeps running in the tray once the window closes; links that open a new tab open in the browser. A second launch shows the first one's window, and a busy port 6875 (Ovrly from source) stops it with a message.

electron-builder packs it (`desktop/electron-builder.yml`) with `dependencies` only: packages only the UI uses are `devDependencies`, Vite bundling them into `dist/`. The files ship unpacked (no asar), as the server serves them, imports them and starts its worker by path. The apps aren't signed: macOS's is signed ad hoc, since Apple Silicon only runs signed code. After changing `desktop/icon.svg` or `tray.svg`, `pnpm exec electron desktop/icons.js` renders their PNGs again.

## Docs

This site lives in `docs/`, one Markdown file per page; `docs/.vitepress/config.js` has the sidebars. Pushing to `master` publishes it to GitHub Pages (`.github/workflows/docs.yml`).

Screenshots are never taken by hand: `pnpm docs:shots` builds the UI, then runs `docs/screenshots/take.js` in the Playwright Docker image. It starts Ovrly on empty data in a temp folder (port 6876), makes workflows from the templates through the editor, and saves PNGs into `docs/public/screenshots/`. Run it again after a UI change, and commit the new images. To add one, add a step to `take.js` and reference `/screenshots/<name>.png` in a page.
