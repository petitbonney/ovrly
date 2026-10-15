// Logic: sends data to "true" or "false" by comparing two values ({key} placeholders filled from data).
import { fill } from '../template.js'

const tests = {
  equals: (a, b) => a.toLowerCase() === b.toLowerCase(),
  contains: (a, b) => a.toLowerCase().includes(b.toLowerCase()),
  '>': (a, b) => Number(a) > Number(b),
  '<': (a, b) => Number(a) < Number(b),
}

export default {
  type: 'if-else',
  label: 'If / else',
  category: 'logic',
  description: 'Sends data to "true" or "false" by comparing two values.',
  fields: {
    value: { vars: true },
    operator: { options: Object.keys(tests) },
    compare: { label: 'Compare with', vars: true },
  },
  outputs: ['true', 'false'],
  config: { value: '{message}', operator: 'contains', compare: '' },
  run({ config, data }) {
    const test = tests[config.operator]
    if (!test) throw new Error(`If / else: unknown operator "${config.operator}", use ${Object.keys(tests).join(', ')}`)
    return { [test(fill(config.value, data), fill(config.compare, data))]: data }
  },
}
