// Logic: sends data to "true" or "false" by comparing two values ({{key}} placeholders filled from data).
import { fill } from '../template.js'

// Also used by the filter node. The text tests ignore case unless "Match case" is on; `matches` is a regular expression.
export const tests = {
  equals: (a, b) => a === b,
  'not equals': (a, b) => a !== b,
  contains: (a, b) => a.includes(b),
  'not contains': (a, b) => !a.includes(b),
  'starts with': (a, b) => a.startsWith(b),
  'ends with': (a, b) => a.endsWith(b),
  matches: (a, b, flags) => new RegExp(b, flags).test(a),
  '>': (a, b) => Number(a) > Number(b),
  '<': (a, b) => Number(a) < Number(b),
  '>=': (a, b) => Number(a) >= Number(b),
  '<=': (a, b) => Number(a) <= Number(b),
  'is empty': (a) => a === '',
  'not empty': (a) => a !== '',
}

// The operators as setting options, labelled in sentence case ("not equals" -> "Not equals"). Also used by the filter node.
export const operators = Object.keys(tests).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))

// Whether the node's comparison holds on the data; `who` names the node in errors.
export function compare(who, config, data) {
  const test = tests[config.operator]
  if (!test) throw new Error(`${who}: unknown operator "${config.operator}", use ${Object.keys(tests).join(', ')}`)
  const same = (text) => (config.matchCase || config.operator === 'matches' ? text : text.toLowerCase())
  return test(same(fill(config.value, data)), same(fill(config.compare, data)), config.matchCase ? '' : 'i')
}

export default {
  type: 'if-else',
  label: 'If / Else',
  icon: 'git-branch', iconRotate: 90,
  category: 'logic',
  group: 'Flow',
  description: 'Sends data to "true" or "false" by comparing two values.',
  fields: {
    value: { vars: true },
    operator: { options: operators },
    compare: { label: 'Compare with', vars: true },
    matchCase: { label: 'Match case' },
  },
  outputs: ['true', 'false'],
  config: { value: '{{message}}', operator: 'contains', compare: '', matchCase: false },
  run: ({ config, data }) => ({ [compare('If / Else', config, data)]: data }),
}
