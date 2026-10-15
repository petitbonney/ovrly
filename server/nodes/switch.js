// Logic: routes data to the first case equal to a value ({key} placeholders filled from data), else to "else".
// Empty cases never match.
import { fill } from '../template.js'

const cases = ['1', '2', '3']

export default {
  type: 'switch',
  label: 'Switch',
  category: 'logic',
  outputs: [...cases, 'else'],
  config: { value: '{args}', case1: '', case2: '', case3: '' },
  run({ config, data }) {
    const value = fill(config.value, data).toLowerCase()
    const hit = cases.find((n) => config[`case${n}`] !== '' && config[`case${n}`].toLowerCase() === value)
    return { [hit ?? 'else']: data }
  },
}
