// Logic: continues only if a comparison holds, like if/else with only its "true" output ({{key}} placeholders filled
// from data).
import { fill } from '../template.js'
import { tests } from './if-else.js'

export default {
  type: 'filter',
  label: 'Filter',
  category: 'logic',
  description: 'Continues only if the comparison holds.',
  fields: {
    value: { vars: true },
    operator: { options: Object.keys(tests) },
    compare: { label: 'Compare with', vars: true },
  },
  config: { value: '{{message}}', operator: 'contains', compare: '' },
  run({ config, data }) {
    const test = tests[config.operator]
    if (!test) throw new Error(`Filter: unknown operator "${config.operator}", use ${Object.keys(tests).join(', ')}`)
    return test(fill(config.value, data), fill(config.compare, data)) ? data : null
  },
}
