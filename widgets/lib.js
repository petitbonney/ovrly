// Widget helpers, shared by the overlay pages (browser) and widget.js files (server).

// Page side: calls render({ state, runtime }) now and on every update from the server. When "stop" or "cancel" ends what
// plays, the page's own handler for it runs instead (end: { stop, cancel }, e.g. play the outro, or cut); a page
// without one renders the new state. render may return a promise (e.g. an animation): once it settles, the
// page tells the server the action finished, so the workflow moves on. EventSource reconnects by itself, so OBS
// sources survive a server restart. In a Merge Widgets page (an iframe marked data-merged), the updates come from the
// parent's stream (mergeSource), as events named by widget id, starting from the last one (mergeLast) without its run.
export function subscribe(render, end = {}) {
  const id = location.pathname.split('/')[2]
  const merged = window.frameElement?.dataset.merged !== undefined && parent.mergeSource
  const onMessage = async (e) => {
    const msg = JSON.parse(e.data)
    if (end[msg.end]) return end[msg.end]()
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
