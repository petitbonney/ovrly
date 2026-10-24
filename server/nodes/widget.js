// Widget: one widget instance (overlay), its own, in a workflow. When the flow reaches it, it runs the action its type
// binds to signals (onSignal: "start", or e.g. TwitchPlays' "push") with the inputs saved in the widget's state, waits
// until the widget has stopped (by itself, or with its stop action), and adds the widget's output to data (e.g.
// { winner }); cancelled, the flow stops there. Reached from a Widget Action node, it runs that node's action instead
// (its stop action if none is picked), and the flow stops there.
import * as widgets from '../widgets.js'

export default {
  type: 'widget',
  label: 'Widget',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'A widget overlay. Starts when the flow reaches it, and goes on once it has stopped; Widget Action nodes in front of it run its other actions.',
  fields: {
    widget: { hidden: true }, // set by dropping the widget onto the graph
  },
  config: { widget: '' },
  async run({ config, data, from, signal }) {
    if (from?.type !== 'widget-action') return widgets.play(config.widget, 'onSignal', null, data, signal)
    await widgets.play(config.widget, from.config.action || 'onStop', from.config.input, data, signal)
    return null
  },
}
