// Action: sends an action to any widget instance, picked by id, e.g. "cancel" to stop a spinning wheel from another
// trigger. Unlike a widget node it doesn't wait for the widget to finish playing: data passes straight on.
import { fill } from '../template.js'
import * as store from '../store.js'
import * as widgets from '../widgets.js'

export default {
  type: 'event-bus',
  label: 'Event Bus',
  category: 'action',
  description: 'Sends an action (e.g. cancel) to any widget instance, without waiting for it to play.',
  fields: {
    widget: { type: 'widget', hint: 'Search by name or paste an instance ID' },
    action: { type: 'action' },
    value: { type: 'input', vars: true }, // only shown for actions that take a value
  },
  config: { widget: '', action: '', value: '' },
  async run({ config, data }) {
    const widget = (await store.list('widgets')).find((w) => w.id === config.widget)
    if (!widget) throw new Error(config.widget ? `Widget not found: ${config.widget}` : 'Event Bus: pick a widget')
    const action = config.action || Object.keys(widgets.types[widget.type].actions)[0]
    widgets.update(widget, { action, value: fill(config.value, data), user: data.user })
    return data
  },
}
