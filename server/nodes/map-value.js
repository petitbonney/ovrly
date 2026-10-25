// Logic: overwrites a data key's value through a list of "from" → "to" (the first equal "from" wins). A "to" is text
// with {{ }} placeholders; a lone {{ expression }} keeps its type. Empty "from" items never match.
import { value } from '../template.js'

export default {
  type: 'map-value',
  label: 'Map Value',
  category: 'logic',
  group: 'Data',
  description: 'Replaces a data key\'s value using a list of "from" → "to".',
  fields: {
    key: { type: 'var', label: 'Key' },
    map: { label: 'Map', hint: 'The "to" can use expressions, e.g. {{ score * 2 }}' },
    noMatch: { label: 'If no match', options: [{ value: 'keep', label: 'Keep value' }, { value: 'default', label: 'Use default' }, { value: 'stop', label: 'Stop' }] },
    fallback: { label: 'Default', vars: true, only: { noMatch: 'default' } },
    matchCase: { label: 'Match case' },
  },
  config: { key: '', map: [{ from: '', to: '' }], noMatch: 'keep', fallback: '', matchCase: false },
  run({ config, data }) {
    if (!config.key) throw new Error('Map Value: no key set')
    const norm = (s) => (config.matchCase ? s : s.toLowerCase())
    const current = data[config.key] == null ? null : norm(String(data[config.key]))
    const hit = current == null ? null : config.map.find((m) => m.from !== '' && norm(m.from) === current)
    if (hit) return { ...data, [config.key]: value(hit.to, data) }
    if (config.noMatch === 'stop') return null
    return config.noMatch === 'default' ? { ...data, [config.key]: value(config.fallback, data) } : data
  },
}
