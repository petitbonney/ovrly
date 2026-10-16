// Logic: routes data to the first case equal to a value ({{key}} placeholders filled from data), else to "else".
// Cases are a list: each gets an output, labelled by the case (its id is its position, from 1). Empty cases never match.
import { fill } from '../template.js'

export default {
  type: 'switch',
  label: 'Switch',
  category: 'logic',
  description: 'Sends data to the first case equal to the value (not case-sensitive), else to "else".',
  fields: { value: { vars: true }, cases: { hint: 'Each case gets its own output' } },
  outputsFrom: 'cases', // one output per case, before the fixed "else"
  outputs: ['else'],
  config: { value: '{{args}}', cases: ['1', '2', '3'] },
  run({ config, data }) {
    const value = fill(config.value, data).toLowerCase()
    const hit = config.cases.findIndex((c) => c !== '' && c.toLowerCase() === value)
    return { [hit >= 0 ? String(hit + 1) : 'else']: data }
  },
}
