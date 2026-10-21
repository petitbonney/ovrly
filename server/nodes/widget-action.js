// Widget Action: placed in front of a widget node (one at most), it makes that widget node run another of its actions,
// e.g. "vote" with "{{args}}" on a voting widget, with the inputs that action asks for. The widget node runs it and the
// flow stops there. Any other node linked after it gets the data as it came in.
export default {
  type: 'widget-action',
  label: 'Widget Action',
  category: 'action',
  group: 'System',
  description: 'Link it to a widget node: that widget runs the action picked here, then the flow stops there.',
  fields: {
    action: { type: 'action' },
    input: { type: 'inputs' }, // the picked action's inputs (see server/widgets.js)
  },
  config: { action: '', input: {} },
  run: ({ data }) => data, // the widget node reads the action from it (server/nodes/widget.js)
}
