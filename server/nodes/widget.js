// Widget: one widget instance (overlay), its own, in a workflow. A link into its main port runs the action its type
// binds to signals (onSignal: "start", or e.g. TwitchPlays' "push") with the inputs saved in the widget's state, waits
// until the widget has stopped (by itself, or with its stop action), and adds the widget's output to data (e.g.
// { winner }); cancelled, the flow stops there. A link into one of its action ports (config.ports, e.g. "stop", or
// "vote" with "{{args}}") runs that action with its inputs saved in the widget's state too, and the flow stops there.
import * as widgets from '../widgets.js'

export default {
  type: 'widget',
  label: 'Widget',
  icon: 'layout-dashboard',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'A widget overlay. Starts when the flow reaches it, and goes on once it has stopped; links into its other ports run its other actions.',
  fields: {
    widget: { hidden: true }, // set by dropping the widget onto the graph
    ports: { hidden: true }, // the actions with a port of their own besides the main one (its tabs, ui/src/Widget.jsx)
  },
  config: { widget: '', ports: [] },
  async run({ config, data, from, signal }) {
    if (!from?.port) return widgets.play(config.widget, 'onSignal', null, data, signal)
    await widgets.play(config.widget, from.port, null, data, signal)
    return null
  },
}
