// Logic: sets, adds to or deletes a variable. Unlike data, variables are shared by all workflows and outlive firings
// and restarts; read one anywhere as {{ $vars.name }}. Adds { value }, the variable's new value.
import { value } from '../template.js'
import { vars, saveVars } from '../vars.js'

export default {
  type: 'edit-variable',
  label: 'Edit Variable',
  icon: 'variable',
  category: 'logic',
  group: 'Data',
  description: 'Sets, adds to or deletes a variable: shared by all workflows, kept across runs and restarts.',
  adds: ['value'],
  fields: {
    name: { hint: 'Read it as {{ $vars.name }}' },
    operation: { options: ['set', 'add', 'delete'] },
    value: { vars: true, hint: 'Not used by delete' },
  },
  config: { name: 'counter', operation: 'add', value: '1' },
  async run({ config, data }) {
    const { name, operation } = config
    if (!/^[\w-]+$/.test(name)) throw new Error('Edit Variable: the name takes letters, digits, "_" and "-"')
    const v = value(config.value, data)
    if (operation === 'set') vars[name] = v
    else if (operation === 'add') vars[name] = (Number(vars[name]) || 0) + (Number(v) || 0)
    else if (operation === 'delete') delete vars[name]
    else throw new Error(`Edit Variable: unknown operation "${operation}"`)
    await saveVars()
    return { ...data, value: vars[name] }
  },
}
