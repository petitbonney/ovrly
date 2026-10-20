// Trigger: fires when another workflow runs this one with an Execute Workflow node, with that node's data.
export default {
  type: 'workflow-call',
  label: 'Called By Workflow',
  category: 'trigger',
  group: 'Other',
  description: 'Fires when another workflow runs this one (Execute Workflow node).',
  event: 'call',
  config: {},
  run: ({ data }) => data,
}
