// Widget: one widget instance (overlay) in a workflow, the "what". It doesn't run: Fire Widget nodes linked to its
// diamond connector run its actions, the "how". One widget node can drive several Fire Widget nodes.
export default {
  type: 'widget',
  label: 'Widget',
  category: 'widget', // not in the library's node sections: widgets are dragged from their own section
  description: 'A widget overlay. Link its diamond to Fire Widget nodes to run its actions.',
  fields: { widget: { hidden: true } }, // set by dropping the widget onto the graph
  config: { widget: '' },
  run: () => null,
}
