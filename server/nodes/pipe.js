// Logic: passes its input on unchanged, e.g. a junction to tidy up links on the graph.
export default {
  type: 'pipe',
  label: 'Pipe',
  icon: 'pipeline', iconRotate: 90,
  category: 'logic',
  group: 'Flow',
  description: 'Passes its input on unchanged.',
  config: {},
  run: ({ data }) => data,
}
