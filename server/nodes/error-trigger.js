// Trigger: fires when a node fails in another workflow (a workflow with an Error Trigger doesn't report its own errors).
export default {
  type: 'error-trigger',
  label: 'Error Trigger',
  icon: 'alert-triangle',
  category: 'trigger',
  group: 'System',
  description: 'Fires when a node fails in another workflow.',
  adds: { errorWorkflow: 'The workflow that failed', errorNode: 'The node that failed', errorMessage: 'What went wrong' },
  event: 'workflow-error',
  config: {},
  manual: { event: () => ({ data: { errorWorkflow: 'Test workflow', errorNode: 'HTTP Request', errorMessage: 'Sample error' } }) },
  run: ({ data }) => data,
}
