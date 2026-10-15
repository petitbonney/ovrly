// Widget helpers, shared by the overlay pages (browser) and widget.js files (server).

// Page side: calls render({ config, state }) now and on every update from the server.
// EventSource reconnects by itself, so OBS sources survive a server restart.
export function subscribe(render) {
  const id = location.pathname.split('/')[2]
  new EventSource(`/w/${id}/events`).onmessage = (e) => render(JSON.parse(e.data))
}

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
