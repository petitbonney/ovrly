// Logic: runs what follows once per item of a list (e.g. a gift's recipients), in order, each with { item, index,
// count } added to the data. The engine sends the items on (`split`). Put a Queue after it to play them in turn.
import { value } from '../template.js'

export default {
  type: 'fan-out',
  label: 'Fan Out',
  category: 'logic',
  description: 'Runs what follows once per item of a list, e.g. {{recipients}}.',
  fields: { list: { vars: true, hint: 'A list, e.g. {{recipients}}' } },
  adds: ['item', 'index', 'count'],
  split: true,
  config: { list: '' },
  run({ config, data }) {
    if (!config.list.trim()) throw new Error('Fan Out: no list set')
    const list = value(config.list, data)
    if (!Array.isArray(list)) throw new Error(`Fan Out: "${config.list}" is not a list`)
    return list.map((item, index) => ({ ...data, item, index, count: list.length }))
  },
}
