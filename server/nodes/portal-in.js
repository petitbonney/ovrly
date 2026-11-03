// Trigger: fires when a Portal Out node sends data through it, from this workflow or another, with that node's data.
export default {
  type: 'portal-in',
  label: 'Portal In',
  icon: 'portal-in', // server/icons/portal-in.svg
  category: 'trigger',
  group: 'System',
  description: 'Fires when a Portal Out node sends data through it.',
  event: 'portal',
  config: {},
  manual: {
    config: { data: '{}' },
    fields: { data: { type: 'json', label: 'Data (JSON)', hint: 'As a Portal Out node would send it' } },
    event: ({ data }) => ({ data: JSON.parse(data || '{}') }),
  },
  run: ({ data }) => data,
}
