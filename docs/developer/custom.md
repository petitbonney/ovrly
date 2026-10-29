# Custom nodes and widgets

You don't need Ovrly's source to add your own types: they live in your `data/custom/` folder, work in the downloaded app, and reload as you save. **Settings → Custom nodes** and **Custom widgets** list them with their errors, import files, reload, and open the folder.

::: danger
Custom code runs as Ovrly does, with full access to your computer. Only add files you trust.
:::

## Custom nodes

A custom node is written like a [built-in one](./nodes), in `data/custom/nodes/<name>.js` (or imported from Settings → Custom nodes). It can't take a built-in type, goes to the library's **Custom** group unless it names its own `group`, and needs `type`, `label`, `category` (`trigger`, `logic` or `action`) and `run`.

Instead of importing Ovrly's files, `run` gets `ovrly`:

| Helper | Does |
| --- | --- |
| `fill(text, data)`, `fillJson`, `fillUrl`, `value`, `list` | `{{ }}` templates (see `server/template.js`) |
| `vars`, `saveVars()` | The variables, and saving them |
| `log(event, data)` | Adds to the events view |
| `twitch.helix(method, path, body, query)`, `twitch.userId()`, `twitch.needStreamer(feature)` | The Twitch API, as the streamer |
| `obs.request(type, data)` | An obs-websocket request |

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

A workflow using a custom node that isn't loaded (removed, broken, or not yet copied to this computer) shows it in red, and a firing that reaches it fails there.

## Custom widgets

A custom widget is a folder in `data/custom/widgets/`, named as its type, written like the [built-in ones](./widgets): `widget.js` (a `start` action at least) and `index.html`, plus any file the page uses (styles, scripts, images, fonts, sounds, videos). Its files are served at `/widgets/<type>/`, so the page uses `/widgets/lib.js`, `/widgets/base.css` and `/vendor/` the same way. Its actions and `on` handlers get `ovrly` too.

**New widget…** in Settings → Custom widgets makes a working one to start from: a text shown for a few seconds.

When a custom widget changes, what plays on its widgets stops, they get its new settings' defaults, and their pages reload (in OBS too). A widget node whose type isn't loaded keeps its settings and shows in red until the type is back.

## Packages in custom code

Custom code has Node's built-ins (`node:fs`, `node:crypto`…) and `fetch`, but no npm installs (the download bundles Node without npm). To use a package:

- **Copy its ESM build** next to your code and import it by a relative path. A node's own files go in a subfolder, e.g. `data/custom/nodes/lib/` (only the `.js` files directly in `nodes/` are nodes); a widget's anywhere in its folder.
- **Or bundle** your code and its packages into one file:
  ```bash
  npx esbuild src/my-node.js --bundle --platform=node --format=esm --outfile=data/custom/nodes/my-node.js
  ```
- **In a page**, map it in the import map: to the `/vendor/` libraries (anime.js, three.js, cannon-es), to a file in the widget's folder (`/widgets/<type>/lib/confetti.js`), or to a CDN with a pinned version (`https://esm.sh/canvas-confetti@1.9.3`). A CDN needs internet when OBS loads the page: prefer a copied file.

Ovrly's own packages are within reach (imports look up to its `node_modules`), but they aren't an API: Ovrly may upgrade or drop them. Use the `ovrly` helpers, `/vendor/` in pages, or a copy of your own. Only a node's file and a widget's `widget.js` reload when changed; the files they import reload on a restart.
