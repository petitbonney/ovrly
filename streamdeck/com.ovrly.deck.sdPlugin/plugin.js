// Ovrly's Stream Deck plugin: the "Ovrly button" action shows a Control Pad node button on a key and fires it.
// It talks to the Stream Deck app over its WebSocket (the Stream Deck SDK's protocol, no library) and to Ovrly over
// HTTP: a stream of the decks (with each button's key image), and posts of the paired keys and of presses.
const OVRLY = process.env.OVRLY_URL ?? 'http://localhost:6875'

// Launch arguments: -port, -pluginUUID, -registerEvent, -info.
const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].slice(1)] = process.argv[i + 1]

const keys = new Map() // context -> { device, column, row, settings: { workflow, node, button } }
const devices = {} // id -> { name, columns, rows }
for (const d of JSON.parse(args.info ?? '{}').devices ?? []) devices[d.id] = { name: d.name, columns: d.size.columns, rows: d.size.rows }
let decks = null // from Ovrly; null while it can't be reached
const inspectors = new Set() // contexts whose settings are open

const sd = new WebSocket(`ws://127.0.0.1:${args.port}`)
const send = (event, context, payload) => sd.send(JSON.stringify({ event, context, payload }))
sd.onopen = () => sd.send(JSON.stringify({ event: args.registerEvent, uuid: args.pluginUUID }))
sd.onclose = () => process.exit()

// What a key's settings point to, if it still exists.
const buttonOf = ({ workflow, node, button } = {}) =>
  decks?.find((d) => d.workflow === workflow && d.node === node)?.buttons.find((b) => b.id === button)

// A grey key with a word, for keys that can't show their button.
const label = (text) => `data:image/svg+xml;charset=utf8,<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
  + `<rect width="144" height="144" fill="rgb(37,38,43)"/><text x="72" y="80" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" `
  + `font-size="20" fill="rgb(160,160,160)">${text}</text></svg>`

// Draws a key: its button, else why not (no image resets it to the action's default).
function draw(context) {
  const { settings } = keys.get(context)
  const image = !settings.button ? undefined : !decks ? label('Ovrly offline') : buttonOf(settings)?.image ?? label('Button gone')
  send('setImage', context, { image, target: 0 })
}

// Tells Ovrly the devices and which keys show which button.
function report() {
  if (!decks) return
  const paired = [...keys].filter(([, k]) => k.settings.button).map(([context, k]) => ({ context, device: k.device, column: k.column, row: k.row, ...k.settings }))
  fetch(`${OVRLY}/api/streamdeck/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ devices, keys: paired }) }).catch(() => {})
}

// The buttons to pick from, for the settings of a key (pi.html).
const offer = (context) => send('sendToPropertyInspector', context, {
  online: !!decks,
  decks: decks?.map(({ workflow, name, node, buttons }) => ({ workflow, name, node, buttons: buttons.map(({ id, name }) => ({ id, name })) })),
})

async function press(context) {
  const { settings } = keys.get(context)
  const result = await fetch(`${OVRLY}/api/streamdeck/press`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    .then((r) => r.json(), () => ({ ok: false }))
  send(result.ok ? 'showOk' : 'showAlert', context)
}

// A key showing the action (coordinates are missing in a multi action), or its settings changed.
function place({ context, device, payload }) {
  keys.set(context, { device, column: payload.coordinates?.column, row: payload.coordinates?.row, settings: payload.settings ?? {} })
  draw(context)
  report()
}

const on = {
  willAppear: place,
  didReceiveSettings: place,
  willDisappear: ({ context }) => keys.delete(context) && report(),
  keyDown: ({ context }) => keys.has(context) && press(context),
  deviceDidConnect: ({ device, deviceInfo: d }) => {
    devices[device] = { name: d.name, columns: d.size.columns, rows: d.size.rows }
    report()
  },
  deviceDidDisconnect: ({ device }) => delete devices[device] && report(),
  propertyInspectorDidAppear: ({ context }) => inspectors.add(context) && offer(context),
  propertyInspectorDidDisappear: ({ context }) => inspectors.delete(context),
  sendToPlugin: ({ context }) => offer(context),
}
sd.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  on[message.event]?.(message)
}

// New decks: every key and open settings follow.
function update(next) {
  decks = next
  for (const context of keys.keys()) draw(context)
  for (const context of inspectors) offer(context)
}

// Ovrly's decks stream (SSE over fetch), reconnecting every 2s while Ovrly is down.
async function listen() {
  for (;;) {
    try {
      const res = await fetch(`${OVRLY}/api/streamdeck/events`)
      let buffer = ''
      for await (const chunk of res.body.pipeThrough(new TextDecoderStream())) {
        buffer += chunk
        for (let end; (end = buffer.indexOf('\n\n')) >= 0; buffer = buffer.slice(end + 2)) {
          const line = buffer.slice(0, end).split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          const first = !decks
          update(JSON.parse(line.slice(6)))
          if (first) report() // Ovrly forgets the keys when the plugin goes away
        }
      }
    } catch {}
    if (decks) update(null)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}
listen()
