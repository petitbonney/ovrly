// Open windows, as "App — Title" names, for Key Press's "Only when focused". macOS asks System Events, which needs
// the Automation permission for it, then the Accessibility one Key Press already needs for titles (nut.js would also
// need Screen Recording); without Accessibility, app names alone. Windows lists the titles of visible windows through
// PowerShell (nut.js lists hidden ones too, hundreds of them); other systems use nut.js window titles.
import { execFile } from 'node:child_process'
import { Router } from 'express'
import { getWindows, getActiveWindow } from '@nut-tree-fork/nut-js'

// -1743: the app running Ovrly may not control System Events (denied once, macOS doesn't ask again).
const osa = (script) => new Promise((resolve, reject) =>
  execFile('osascript', ['-e', script], (err, out) => (err ? reject(err.message.includes('-1743')
    ? new Error('Allow the app running Ovrly to control System Events: System Settings → Privacy & Security → Automation')
    : err) : resolve(out.trim()))))

// Each process's main window title: visible windows only, UTF-8 for titles beyond ASCII.
const ps = () => new Promise((resolve, reject) => execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Process | Where-Object MainWindowTitle | ForEach-Object MainWindowTitle'],
{ windowsHide: true }, (err, out) => (err ? reject(err) : resolve(out.split(/\r?\n/)))))

// One "app<TAB>title" line per window (title empty if unreadable) of the given processes.
const lines = (processes) => `
tell application "System Events"
  set out to ""
  repeat with p in (${processes})
    set out to out & name of p & tab & linefeed
    try
      repeat with w in (every window of p)
        try
          set out to out & name of p & tab & name of w & linefeed
        end try
      end repeat
    end try
  end repeat
  return out
end tell`

const names = (out) => out.split('\n').filter(Boolean).map((l) => {
  const [app, title] = l.split('\t')
  return title ? `${app} — ${title}` : app
})

// Every open window, plus each app on its own (picking it matches any of its windows).
export async function list() {
  if (process.platform === 'win32') return ps()
  if (process.platform !== 'darwin') return Promise.all((await getWindows()).map((w) => w.title.catch(() => '')))
  return names(await osa(lines('every application process whose background only is false')))
}

// The focused window: "App — Title" (macOS), or its title.
export async function focused() {
  if (process.platform !== 'darwin') return (await getActiveWindow()).title
  // Its front window is the first one listed; the app alone when titles can't be read.
  const [app, front] = names(await osa(lines('every application process whose frontmost is true')))
  return front ?? app ?? ''
}

// Route: the open windows, for Key Press's "Only when focused" picker, with a hint when macOS gave app names alone.
export const routes = Router()
routes.get('/api/windows', (req, res) => list().then((all) => {
  const found = [...new Set(all.filter(Boolean))]
  const titles = process.platform !== 'darwin' || !found.length || found.some((n) => n.includes(' — '))
  res.json({ windows: found, hint: titles ? '' : 'Window titles need the Accessibility permission' })
}, (err) => res.status(503).json({ error: err.message })))
