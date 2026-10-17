// Trigger: fires when a node fails in another workflow (a workflow with an Error Trigger doesn't report its own errors).
export default {
  type: 'error-trigger',
  label: 'Error Trigger',
  category: 'trigger',
  description: 'Fires when a node fails in another workflow.',
  adds: ['workflow', 'node', 'error'],
  event: 'workflow-error',
  config: {},
  run: ({ data }) => data,
}
