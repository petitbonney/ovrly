// Logic: continues only if data[field] contains the given text (case-insensitive).
export default {
  type: 'filter',
  label: 'Filter',
  category: 'logic',
  description: 'Continues only if a data field contains some text (case-insensitive).',
  fields: { field: { type: 'var' }, contains: {} },
  config: { field: 'message', contains: '' },
  run({ config, data }) {
    const value = String(data[config.field] ?? '').toLowerCase()
    return value.includes(config.contains.toLowerCase()) ? data : null
  },
}
