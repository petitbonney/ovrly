// Trigger: fires when a node fails in another workflow (a workflow with an Error Trigger doesn't report its own errors).
export default {
  type: 'error-trigger',
  label: 'Error Trigger',
  icon: 'alert-triangle',
  category: 'trigger',
  group: 'Other',
  description: 'Fires when a node fails in another workflow.',
  adds: ['workflow', 'node', 'error'],
  event: 'workflow-error',
  config: {},
  manual: { event: () => ({ data: { workflow: 'Test workflow', node: 'HTTP Request', error: 'Sample error' } }) },
  run: ({ data }) => data,
}
