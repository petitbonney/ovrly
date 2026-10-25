// Logic: runs JavaScript on the data. Not sandboxed: it is as powerful as the server, so only import workflows you trust.
import { vars, saveVars } from '../vars.js'

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

export default {
  type: 'code',
  label: 'Code',
  icon: 'code',
  category: 'logic',
  group: 'Data',
  description: 'Runs JavaScript: `data` is the current data, `$vars` the variables; return the new data, or null to stop.',
  fields: { code: { type: 'code', hint: 'await works. Returning nothing keeps the data as it is.' } },
  config: { code: 'return { ...data, shout: String(data.message ?? "").toUpperCase() }' },
  async run({ config, data }) {
    const before = JSON.stringify(vars)
    const out = await new AsyncFunction('data', '$vars', config.code)(data, vars)
    if (JSON.stringify(vars) !== before) await saveVars() // the code changed a variable
    if (out === undefined) return data
    if (out !== null && (typeof out !== 'object' || Array.isArray(out))) throw new Error('Code: return an object, or null to stop')
    return out
  },
}
