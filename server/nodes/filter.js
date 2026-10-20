// Logic: continues only if a comparison holds, like if/else with only its "true" output ({{key}} placeholders filled
// from data).
import { tests, compare } from './if-else.js'

export default {
  type: 'filter',
  label: 'Filter',
  category: 'logic',
  group: 'Flow',
  description: 'Continues only if the comparison holds.',
  fields: {
    value: { vars: true },
    operator: { options: Object.keys(tests) },
    compare: { label: 'Compare with', vars: true },
    matchCase: { label: 'Match case' },
  },
  config: { value: '{{message}}', operator: 'contains', compare: '', matchCase: false },
  run: ({ config, data }) => (compare('Filter', config, data) ? data : null),
}
