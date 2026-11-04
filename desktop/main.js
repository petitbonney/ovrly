// Desktop app (Electron): runs the server in this process and shows the editor in a window. Closing the window keeps
// Ovrly running in the tray (widgets, Stream Deck and workflows still need it on stream); Quit is in the tray menu.
import net from 'node:net'
import path from 'node:path'
import tls from 'node:tls'
import { app, BrowserWindow, Menu, Tray, dialog, shell } from 'electron'

// Trust the system's certificates too, as the window (Chromium) does: TLS intercepted by an antivirus or a company proxy
// is signed by one, and Twitch, OBS's and the downloads' connections would fail on Node's bundled list alone.
tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])

const PORT = process.env.PORT || 6875 // the server's: OBS browser sources and the Stream Deck plugin point at it
const EDITOR = `http://localhost:${PORT}`
const icon = (name) => path.join(import.meta.dirname, name)
let win, tray
let quitting = false

// Whether nothing listens on the port yet (Ovrly started another way would: its launcher, or pnpm dev).
const free = () => new Promise((resolve) => {
  const probe = net.createServer().once('error', () => resolve(false))
  probe.listen(PORT, () => probe.close(() => resolve(true)))
})

function show() {
  if (!win) {
    win = new BrowserWindow({ width: 1440, height: 900, show: false, title: 'Ovrly', icon: icon('icon.png') })
    // Links that open a new tab (docs, Twitch sign-in, widget pages) open in the browser instead.
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
    win.on('close', (e) => {
      if (quitting) return
      e.preventDefault()
      win.hide()
    })
    win.on('closed', () => (win = null)) // closed anyway (the page's window.close()): the next show makes a new one
    win.once('ready-to-show', () => win.show())
    win.loadURL(EDITOR)
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

if (!app.requestSingleInstanceLock()) app.quit() // already running: that one shows its window (second-instance)
else {
  app.on('second-instance', show)
  app.on('activate', show) // the Dock icon (macOS)
  app.on('before-quit', () => (quitting = true))
  app.on('window-all-closed', () => {}) // keep running in the tray (Electron quits by default)
  // Not a top-level await: Electron fires ready only once this module has finished loading.
  app.whenReady().then(async () => {
    if (!(await free())) {
      dialog.showErrorBox('Ovrly is already running', `Something already uses port ${PORT}, probably Ovrly started from its launcher or from source. Quit it, then open Ovrly again.`)
      return app.quit()
    }
    // The server reads its files relative to the app folder, and writes to the user's own (./data when run from source).
    if (app.isPackaged) process.env.OVRLY_DATA ??= path.join(app.getPath('userData'), 'data')
    process.env.NODE_ENV = 'production'
    process.chdir(app.getAppPath())
    await import('../server/index.js')
    const { dataDir } = await import('../server/store.js')

    tray = new Tray(icon(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'))
    tray.setToolTip('Ovrly')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Ovrly', click: show },
      { label: 'Open in browser', click: () => shell.openExternal(EDITOR) },
      { label: 'Open data folder', click: () => shell.openPath(dataDir) },
      { type: 'separator' },
      { label: 'Quit Ovrly', role: 'quit' },
    ]))
    tray.on('click', show) // Windows; macOS opens the menu
    show()
  })
}
