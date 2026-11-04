// Renders the app and tray icons (icon.svg, tray.svg) to the PNGs electron-builder and the tray use, with Electron's own
// Chromium: `pnpm exec electron desktop/icons.js` after changing an SVG.
import fs from 'node:fs'
import { app, BrowserWindow } from 'electron'

const here = (name) => new URL(name, import.meta.url)
// [svg, png, size, color] (color replaces black, for the Windows tray, which doesn't recolor).
const OUT = [
  ['icon.svg', 'icon.png', 1024],
  ['tray.svg', 'trayTemplate.png', 18],
  ['tray.svg', 'trayTemplate@2x.png', 36],
  ['tray.svg', 'tray.png', 32, '#12b886'],
]

// Not a top-level await: Electron fires ready only once the main module has finished loading.
app.dock?.hide()
app.on('window-all-closed', () => {}) // closing each icon's window mustn't quit before the next
app.whenReady().then(async () => {
  for (const [svg, png, size, color] of OUT) {
    let text = fs.readFileSync(here(svg), 'utf8')
    if (color) text = text.replaceAll('stroke="#000"', `stroke="${color}"`)
    const win = new BrowserWindow({ width: size, height: size, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true, zoomFactor: 1 } })
    const html = `<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${text}`
    await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
    fs.writeFileSync(here(png), (await win.webContents.capturePage()).resize({ width: size, height: size }).toPNG())
    win.destroy()
  }
  app.quit()
})
