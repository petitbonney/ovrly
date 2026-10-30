// Trigger: fires when an Execute Workflow node runs it (picked as "workflow > id"), with that node's data.
export default {
  type: 'workflow-call',
  label: 'Called By Workflow',
  icon: 'arrow-bar-to-right',
  category: 'trigger',
  group: 'Other',
  description: 'Fires when another workflow runs this one (Execute Workflow node).',
  event: 'call',
  fields: { id: { type: 'id', label: 'ID', hint: 'Execute Workflow nodes pick it by this name' } },
  config: { id: 'main' }, // new nodes get a UUID (ui/src/Workflow.jsx); 'main' is for older ones
  manual: {
    config: { data: '{}' },
    fields: { data: { type: 'json', label: 'Data (JSON)', hint: 'As an Execute Workflow node would pass it' } },
    event: ({ data }) => ({ data: JSON.parse(data || '{}') }),
  },
  run: ({ data }) => data,
}
