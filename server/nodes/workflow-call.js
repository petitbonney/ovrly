// Trigger: fires when an Execute Workflow node runs it (picked as "workflow > id"), with that node's data.
export default {
  type: 'workflow-call',
  label: 'Called By Workflow',
  category: 'trigger',
  group: 'Other',
  description: 'Fires when another workflow runs this one (Execute Workflow node).',
  event: 'call',
  fields: { id: { type: 'id', label: 'ID', hint: 'Execute Workflow nodes pick it by this name' } },
  config: { id: 'main' }, // new nodes get a UUID (ui/src/Workflow.jsx); 'main' is for older ones
  run: ({ data }) => data,
}
