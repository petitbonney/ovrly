// Trigger: fires on a request to /hooks/<path> (any method, e.g. POST /hooks/my-hook {"user":"bob"}). The query and JSON body become data.
export default {
  type: 'webhook',
  label: 'API Call',
  icon: 'webhook',
  category: 'trigger',
  group: 'System',
  description: 'Fires on a request to /hooks/<path> on this server; the query and JSON body become data.',
  adds: { hookPath: 'The path called, after /hooks/' },
  fields: { path: { hint: 'Any method works, e.g. POST /hooks/my-hook {"user": "bob"}' } },
  event: 'webhook',
  config: { path: 'my-hook' },
  manual: {
    config: { body: '{"user": "bob"}' },
    fields: { body: { type: 'json', label: 'Data (JSON)', hint: 'As the query and JSON body of a request' } },
    event: ({ body }, config) => ({ data: { ...JSON.parse(body || '{}'), hookPath: config.path } }),
  },
  run: ({ config, data }) => (data.hookPath === config.path ? data : null),
}
