// Widget: one widget instance (overlay) in a workflow. When the flow reaches it, it runs its widget's input action
// ("start", or the one its type links instead, e.g. TwitchPlays' "push") with the inputs set here, waits until the
// widget has stopped (by itself, or with "stop"), and adds the widget's output to data (e.g. { winner }); cancelled, the
// flow stops there. Reached from a Widget Action node, it runs that node's action instead, and the flow stops there.
import * as widgets from '../widgets.js'

export default {
  type: 'widget',
  label: 'Widget',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'A widget overlay. Starts when the flow reaches it, and goes on once it has stopped; Widget Action nodes in front of it run its other actions.',
  fields: {
    widget: { hidden: true }, // set by dropping the widget onto the graph
    input: { type: 'inputs', linked: true }, // the inputs of the action its type links to it, if it takes any
  },
  config: { widget: '', input: {} },
  async run({ config, data, from, signal }) {
    if (from?.type !== 'widget-action') return widgets.play(config.widget, '', config.input, data, signal)
    await widgets.play(config.widget, from.config.action || 'stop', from.config.input, data, signal)
    return null
  },
}
