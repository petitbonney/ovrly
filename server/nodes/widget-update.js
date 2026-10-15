// Action: runs an action on a widget overlay (found by name or id), e.g. "vote" on a poll with value "{args}".
// Waits until the overlay has finished playing it (e.g. the wheel stopped), so the next nodes run after, and adds
// the widget's output to data (e.g. { winner } from the wheel). A widget with a single action needs none set.
import { fill } from '../template.js'
import * as store from '../store.js'
import * as widgets from '../widgets.js'

export default {
  type: 'widget-update',
  label: 'Widget',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'Runs an action on a widget overlay, waits until it has finished playing, then passes on its result.',
  fields: {
    widget: { hidden: true }, // set by dropping the widget onto the graph
    action: { type: 'action' },
    value: { type: 'input', vars: true }, // only shown for actions that take a value
  },
  config: { widget: '', action: '', value: '' },
  async run({ config, data }) {
    const widget = (await store.list('widgets')).find((w) => w.id === config.widget || w.name === config.widget)
    if (!widget) throw new Error(`Widget not found: ${config.widget}`)
    const action = config.action || Object.keys(widgets.types[widget.type].actions)[0]
    const { done, output } = widgets.update(widget, { action, value: fill(config.value, data), user: data.user })
    await done
    return { ...data, ...output }
  },
}
