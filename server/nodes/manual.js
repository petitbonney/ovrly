// Trigger: fires when you press Run in the workflow editor, with the given JSON as data.
export default {
  type: 'manual',
  label: 'Manual trigger',
  category: 'trigger',
  event: 'manual',
  config: { data: '{"user": "streamer"}' },
  run: ({ config, data }) => ({ ...JSON.parse(config.data || '{}'), ...data }),
}
