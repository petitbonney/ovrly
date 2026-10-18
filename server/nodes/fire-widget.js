// Action: runs an action on each widget linked to its diamond input, e.g. "spin" on a wheel or "vote" with "{{args}}".
// Each widget has its own action and value in config.widgets[instance id] (older nodes keep them at the top level).
// Fires all of them together and waits until the overlays have finished playing (e.g. the wheel stopped), so the next
// nodes run after, and adds the widgets' outputs to data (e.g. { winner } from the wheel). With no action set, it
// runs the widget's first one. If another action on the same widget cancels one before it ends, this run stops here;
// if the workflow is cancelled, the widgets' actions are cancelled too.
import { fill } from '../template.js'
import * as store from '../store.js'
import * as widgets from '../widgets.js'

export default {
  type: 'fire-widget',
  label: 'Fire Widget',
  category: 'action',
  description: 'Runs an action on each widget linked to its diamond input, and waits until they have finished playing.',
  widgetInput: true, // the engine passes the linked widget nodes' instance ids as `widgets`
  fields: {
    action: { type: 'action' },
    value: { type: 'input', vars: true }, // only shown for actions that take a value
  },
  config: { action: '', value: '' },
  async run({ config, data, signal, widgets: ids }) {
    if (!ids.length) throw new Error('Fire Widget: link a widget node to its diamond input')
    const all = await store.list('widgets')
    const fired = await Promise.all(ids.map(async (id) => {
      const widget = all.find((w) => w.id === id || w.name === id)
      if (!widget) throw new Error(`Widget not found: ${id}`)
      const own = config.widgets ? config.widgets[widget.id] ?? {} : config
      const action = own.action || Object.keys(widgets.types[widget.type].actions)[0]
      const { done, output, run } = await widgets.update(widget, { action, value: fill(own.value ?? '', data), user: data.user })
      signal.addEventListener('abort', () => widgets.cancel(widget, run), { once: true })
      return (await done) ? output : null
    }))
    if (fired.includes(null)) return null
    return Object.assign({ ...data }, ...fired)
  },
}
