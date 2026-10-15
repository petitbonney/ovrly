// Event bus: every source publishes events here; the engine listens. Recent events are kept for GET /api/events.
import { EventEmitter } from 'node:events'

const bus = new EventEmitter()

// The last 200 events, newest first: { at, channel, event, data }. In memory only, for the developer view.
// channel is how the event travelled: bus, http, websocket or sse (widget overlays).
export const recent = []
export function record(channel, event, data) {
  recent.unshift({ at: new Date().toISOString(), channel, event, data })
  recent.splice(200)
}

// Every emitted event is recorded before listeners run.
const emit = bus.emit.bind(bus)
bus.emit = (event, data) => {
  record('bus', event, data)
  return emit(event, data)
}

export default bus
