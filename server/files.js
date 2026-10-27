// Images and sounds for the Image and Sound widgets are files on disk, used where they are: "Browse files" opens the OS
// file dialog here (a browser page can't see file paths) and /file serves a path set on a node. Only image, sound and video types,
// so this can't leak other files; no SVG: opened directly, it could run scripts on Ovrly's origin.
import path from 'node:path'
import { execFile } from 'node:child_process'

const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|apng|mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|m4v|ogv)$/i
// "Browse files" per kind: the dialog's prompt, the macOS file types and the extensions (Windows) it allows.
const BROWSE = {
  image: ['Pick an image or GIF', ['public.png', 'public.jpeg', 'com.compuserve.gif', 'org.webmproject.webp', 'public.avif'], ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'apng']],
  sound: ['Pick a sound', ['public.mp3', 'com.microsoft.waveform-audio', 'org.xiph.ogg-audio', 'public.mpeg-4-audio', 'public.aac-audio', 'org.xiph.flac'], ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']],
  video: ['Pick a video', ['public.mpeg-4', 'com.apple.quicktime-movie', 'org.webmproject.webm'], ['mp4', 'webm', 'mov', 'm4v', 'ogv']],
}
// The OS's own file dialog, as a command that prints the picked path (nothing if cancelled).
const dialog = (prompt, types, exts) => process.platform === 'darwin'
  ? ['osascript', ['-e', `POSIX path of (choose file with prompt "${prompt}" of type {${types.map((t) => `"${t}"`).join(', ')}})`]]
  : ['powershell', ['-NoProfile', '-STA', '-Command', `
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    Add-Type -AssemblyName System.Windows.Forms
    $d = New-Object Windows.Forms.OpenFileDialog
    $d.Title = '${prompt}'
    $d.Filter = '${prompt}|${exts.map((e) => `*.${e}`).join(';')}'
    $owner = New-Object Windows.Forms.Form -Property @{ TopMost = $true } # keeps the dialog in front of the browser
    if ($d.ShowDialog($owner) -eq 'OK') { $d.FileName }`]]

// POST /api/browse-:kind: answers { path } with the picked file, {} if cancelled.
export function browse(req, res) {
  const [prompt, types, exts] = BROWSE[req.params.kind] ?? []
  if (!prompt) return res.sendStatus(404)
  if (process.platform !== 'darwin' && process.platform !== 'win32') return res.status(501).json({ error: `Browse files only works on macOS and Windows for now: paste the file path or a URL` })
  const [cmd, args] = dialog(prompt, types, exts)
  execFile(cmd, args, (err, out) => res.json(err || !out.trim() ? {} : { path: out.trim() })) // an error is a cancel on macOS
}

// GET /file?path=<absolute path>: the media file there.
export function serve(req, res) {
  const file = String(req.query.path ?? '')
  if (!path.isAbsolute(file) || !MEDIA_EXT.test(file)) return res.status(400).end()
  res.sendFile(file, { dotfiles: 'allow' }, (err) => err && !res.headersSent && res.status(404).end())
}
