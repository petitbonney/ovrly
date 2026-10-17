// Logic: adds or overwrites data keys, which only travel on in this run (unlike variables). A value is text with {{ }} placeholders; a lone {{ expression }} keeps its type.
import { value } from '../template.js'

export default {
  type: 'edit-data',
  label: 'Edit Data',
  category: 'logic',
  description: 'Adds or overwrites data keys for this run only, from text and {{ }} expressions.',
  addsFrom: 'values', // the editor offers these items' names as {{key}} in later nodes
  fields: { values: { label: 'Keys', hint: 'The value can use expressions, e.g. {{ score * 2 }}' } },
  config: { values: [{ name: 'key', value: '' }] },
  run({ config, data }) {
    return { ...data, ...Object.fromEntries(config.values.filter((v) => v.name).map((v) => [v.name, value(v.value, data)])) }
  },
}
