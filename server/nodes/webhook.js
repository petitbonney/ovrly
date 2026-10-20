// Trigger: fires on a request to /hooks/<path> (any method, e.g. POST /hooks/my-hook {"user":"bob"}). The query and JSON body become data.
export default {
  type: 'webhook',
  label: 'API Call',
  category: 'trigger',
  group: 'Other',
  description: 'Fires on a request to /hooks/<path> on this server; the query and JSON body become data.',
  adds: ['path'],
  fields: { path: { hint: 'Any method works, e.g. POST /hooks/my-hook {"user": "bob"}' } },
  event: 'webhook',
  config: { path: 'my-hook' },
  run: ({ config, data }) => (data.path === config.path ? data : null),
}
