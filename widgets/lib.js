// Widget helpers, shared by the overlay pages (browser) and widget.js files (server).

// Page side: calls render({ config, state }) now and on every update from the server, and stop() when the "cancel"
// action asks the page to stop its animation. The "show" and "hide" actions fade the whole page (base.css). render may return a promise (e.g. an animation): once it settles, the
// page tells the server the action finished, so the workflow moves on. EventSource reconnects by itself, so OBS
// sources survive a server restart.
export function subscribe(render, stop) {
  const id = location.pathname.split('/')[2]
  new EventSource(`/w/${id}/events`).onmessage = async (e) => {
    const msg = JSON.parse(e.data)
    document.body.classList.toggle('hidden', msg.hidden)
    if (msg.cancel) return stop?.()
    await render(msg)
    if (msg.run) fetch(`/w/${id}/done`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: msg.run }) })
  }
}

// Page side: a promise that resolves after ms, for render to return while an animation plays.
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)))

// "Red, Blue,Green" -> ['Red', 'Blue', 'Green']
export const list = (text) => String(text).split(',').map((s) => s.trim()).filter(Boolean)

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
