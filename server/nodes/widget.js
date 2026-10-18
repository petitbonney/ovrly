// Widget: one widget instance (overlay) in a workflow. When the flow reaches it, it runs its widget's main action
// (e.g. "spin" on a lottery) with the value set here, waits until the overlay has finished playing, and adds the
// widget's output to data (e.g. { winner }). Widget Callback nodes run its other actions, or run it again.
import * as widgets from '../widgets.js'

export default {
  type: 'widget',
  label: 'Widget',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'A widget overlay. Runs its main action when the flow reaches it; Widget Callback nodes run its other actions.',
  fields: {
    widget: { hidden: true }, // set by dropping the widget onto the graph
    value: { type: 'input', vars: true }, // only shown if the main action takes a value
  },
  config: { widget: '', value: '' },
  run: ({ config, data, signal }) => widgets.play(config.widget, '', config.value, data, signal),
}
