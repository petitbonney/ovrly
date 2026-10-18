// Widget Callback: runs any action on a widget of this workflow (picked by instance id), e.g. "cancel" on a lottery
// or the poll's "vote" with "{{args}}", or its main action a second time. Waits until the overlay has finished
// playing and adds the widget's output to data, like the widget node.
import * as widgets from '../widgets.js'

export default {
  type: 'widget-callback',
  label: 'Widget Callback',
  category: 'action',
  description: 'Runs an action on a widget of this workflow, and waits until it has finished playing.',
  fields: {
    widget: { type: 'widget', label: 'Widget', hint: 'A widget node of this workflow, by name or instance ID' },
    action: { type: 'action' },
    value: { type: 'input', vars: true }, // only shown for actions that take a value
  },
  config: { widget: '', action: '', value: '' },
  run: ({ config, data, signal }) => widgets.play(config.widget, config.action, config.value, data, signal),
}
