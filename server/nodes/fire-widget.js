// Action: runs an action on the widget linked to its diamond input, e.g. "spin" on a wheel or "vote" with "{{args}}".
// Waits until the overlay has finished playing it (e.g. the wheel stopped), so the next nodes run after, and adds
// the widget's output to data (e.g. { winner } from the wheel). With no action set, it runs the widget's first one.
// If another action on the same widget cancels this one before it ends, this run stops here; if the workflow is
// cancelled, the widget's action is cancelled too.
import { fill } from '../template.js'
import * as store from '../store.js'
import * as widgets from '../widgets.js'

export default {
  type: 'fire-widget',
  label: 'Fire Widget',
  category: 'action',
  description: 'Runs an action on the widget linked to its diamond input, and waits until it has finished playing.',
  widgetInput: true, // the engine passes the linked widget node's instance id as `widget`
  fields: {
    action: { type: 'action' },
    value: { type: 'input', vars: true }, // only shown for actions that take a value
  },
  config: { action: '', value: '' },
  async run({ config, data, signal, widget: id }) {
    if (!id) throw new Error('Fire Widget: link a widget node to its diamond input')
    const widget = (await store.list('widgets')).find((w) => w.id === id || w.name === id)
    if (!widget) throw new Error(`Widget not found: ${id}`)
    const action = config.action || Object.keys(widgets.types[widget.type].actions)[0]
    const { done, output, run } = widgets.update(widget, { action, value: fill(config.value, data), user: data.user })
    signal.addEventListener('abort', () => widgets.cancel(widget, run), { once: true })
    if (!(await done)) return null
    return { ...data, ...output }
  },
}
