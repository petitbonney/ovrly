// Trigger: fires on a request to /hooks/<path> (any method, e.g. POST /hooks/my-hook {"user":"bob"}). The query and JSON body become data.
export default {
  type: 'webhook',
  label: 'API Call',
  icon: 'webhook',
  category: 'trigger',
  group: 'Other',
  description: 'Fires on a request to /hooks/<path> on this server; the query and JSON body become data.',
  adds: ['path'],
  fields: { path: { hint: 'Any method works, e.g. POST /hooks/my-hook {"user": "bob"}' } },
  event: 'webhook',
  config: { path: 'my-hook' },
  manual: {
    config: { body: '{"user": "bob"}' },
    fields: { body: { type: 'json', label: 'Data (JSON)', hint: 'As the query and JSON body of a request' } },
    event: ({ body }, config) => ({ data: { ...JSON.parse(body || '{}'), path: config.path } }),
  },
  run: ({ config, data }) => (data.path === config.path ? data : null),
}
