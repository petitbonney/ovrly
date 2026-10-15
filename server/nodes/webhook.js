// Trigger: fires on a request to /hooks/<path> (any method, e.g. POST /hooks/my-hook {"user":"bob"}). The query and JSON body become data.
export default {
  type: 'webhook',
  label: 'API call',
  category: 'trigger',
  event: 'webhook',
  config: { path: 'my-hook' },
  run: ({ config, data }) => (data.path === config.path ? data : null),
}
