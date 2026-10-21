// Widget: one widget instance (overlay) in a workflow. When the flow reaches it, it runs its widget's main action
// (e.g. "spin" on a lottery) with the inputs set here, waits until the overlay has finished playing, and adds the
// widget's output to data (e.g. { winner }). Reached from a Widget Action node, it runs that node's action instead
// (once it has finished playing, the flow stops: its links follow its main action only).
import * as widgets from '../widgets.js'

export default {
  type: 'widget',
  label: 'Widget',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'A widget overlay. Runs its main action when the flow reaches it; Widget Action nodes in front of it run its other actions.',
  fields: {
    widget: { hidden: true }, // set by dropping the widget onto the graph
    input: { type: 'inputs' }, // the main action's inputs, if it takes any
  },
  config: { widget: '', input: {} },
  async run({ config, data, from, signal }) {
    if (from?.type !== 'widget-action') return widgets.play(config.widget, '', config.input, data, signal)
    await widgets.play(config.widget, from.config.action, from.config.input, data, signal)
    return null
  },
}
