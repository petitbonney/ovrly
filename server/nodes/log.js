// Action: prints the current data to the server console, and records it as a `log` event (GET /api/events).
import { record } from '../bus.js'

export default {
  type: 'log',
  label: 'Log',
  icon: 'notes',
  category: 'action',
  group: 'System',
  description: 'Prints the current data to the server console and the events view, and shows the last one here.',
  config: {},
  run({ data }) {
    console.log('[log]', data)
    record('log', 'log', data)
    return data
  },
}
