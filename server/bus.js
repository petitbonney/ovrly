// Event bus: every source publishes events here; the engine listens. Recent events are kept for GET /api/events.
import { EventEmitter } from 'node:events'

const bus = new EventEmitter()

// The last 200 events, newest first: { at, event, data }. In memory only, for the developer view.
export const recent = []
export function record(event, data) {
  recent.unshift({ at: new Date().toISOString(), event, data })
  recent.splice(200)
}

// Every emitted event is recorded before listeners run.
const emit = bus.emit.bind(bus)
bus.emit = (event, data) => {
  record(event, data)
  return emit(event, data)
}

export default bus
