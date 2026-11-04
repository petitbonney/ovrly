// Widget helpers, shared by the overlay pages (browser) and widget.js files (server).

// Page side: calls render({ state, runtime }) now and on every update from the server. When "stop" or "cancel" ends what
// plays, the page's own handler for it runs instead, given the update (end: { stop, cancel }, e.g. play the outro, or
// cut); a page without one renders the new state. render may return a promise (e.g. an animation): once it settles, the
// page tells the server the action finished, so the workflow moves on. EventSource reconnects by itself, so OBS
// sources survive a server restart, and a page reloads when its type does (a custom widget changed). In a Merge Widgets page (an iframe marked data-merged), the updates come from the
// parent's stream (mergeSource), as events named by widget id, starting from the last one (mergeLast) without its run.
export function subscribe(render, end = {}) {
  const id = location.pathname.split('/')[2]
  const merged = window.frameElement?.dataset.merged !== undefined && parent.mergeSource
  const onMessage = async (e) => {
    const msg = JSON.parse(e.data)
    if (msg.reload) return location.reload()
    if (end[msg.end]) return end[msg.end](msg)
    await render(msg)
    if (msg.run) fetch(`/w/${id}/done`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: msg.run }) })
  }
  if (!merged) {
    new EventSource(`/w/${id}/events`).onmessage = onMessage
    return
  }
  merged.addEventListener(id, onMessage)
  const last = parent.mergeLast?.[id]
  if (last) onMessage({ data: JSON.stringify({ ...JSON.parse(last), run: undefined, end: undefined }) })
}

// Page side: loads a Google Fonts family, bold (the pages' weight) when it has it, else its regular (Google answers 400
// for a weight a family lacks). Offline, or for a name that isn't a family, the page's font shows.
let font
export function loadFont(family) {
  font ??= document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet' }))
  if (!family || font.dataset.family === family) return
  const css = (bold) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}${bold ? ':wght@700' : ''}&display=block`
  font.dataset.family = family
  font.onerror = () => {
    font.onerror = null
    font.href = css(false)
  }
  font.href = css(true)
}

// A text's look (Label, Countdown, Timer): its default state and settings, spread into a widget type's own, any of them
// overridden there (e.g. a bigger size). The page puts it on its text with styleText.
export const textStyle = {
  state: { font: 'Inter', color: '#ffffff', size: 48, align: 'center' },
  fields: {
    font: { type: 'font', hint: 'A Google Fonts family' },
    color: {},
    size: {
      unit: 'px',
      slider: true,
      presets: [{ value: 24, label: 'XS' }, { value: 36, label: 'S' }, { value: 48, label: 'M' }, { value: 72, label: 'L' }, { value: 96, label: 'XL' }],
    },
    // As Word's paragraph buttons: icons, their names on hover.
    align: {
      options: [
        { value: 'left', label: 'Align to Left', icon: 'align-left' },
        { value: 'center', label: 'Centre Text', icon: 'align-center' },
        { value: 'right', label: 'Align to Right', icon: 'align-right' },
        { value: 'justify', label: 'Justify Text', icon: 'align-justified' },
      ],
    },
  },
}

// Page side: puts a textStyle on an element (a block as wide as the page, so its lines follow the alignment).
export function styleText(el, { font, color, size, align }) {
  loadFont(font)
  Object.assign(el.style, { fontFamily: `"${font}", system-ui, sans-serif`, color, fontSize: `${size}px`, textAlign: align })
}

// Page side: a promise that resolves after ms, for render to return while an animation plays.
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)))

// Finds an option from chat input: its number ("2") or its name ("blue"). Returns the index or -1.
export function pick(options, value) {
  const n = Number(value)
  if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1
  return options.findIndex((o) => o.toLowerCase() === String(value).toLowerCase())
}

// Page side: builds an element; strings become text nodes, so chat input is never parsed as HTML.
export function el(tag, className, ...children) {
  const node = document.createElement(tag)
  node.className = className
  node.append(...children)
  return node
}
