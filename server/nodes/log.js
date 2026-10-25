// Action: prints a message and the current data to the server console, and records it as a `log` event (GET /api/events).
import { record } from '../bus.js'

export default {
  type: 'log',
  label: 'Log',
  icon: 'notes',
  category: 'action',
  group: 'System',
  description: 'Prints a message and the current data to the server console and the events view.',
  config: { message: 'log' },
  run({ config, data }) {
    console.log(`[${config.message}]`, data)
    record('log', config.message, data)
    return data
  },
}
