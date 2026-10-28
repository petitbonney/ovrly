// Logic: runs JavaScript on the data. Not sandboxed: it is as powerful as the server, so only import workflows you trust.
import { format } from 'node:util'
import { vars, saveVars } from '../vars.js'

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

// The line of the code an error was thrown at, if it was there (V8 counts the function's 2-line header).
const lineOf = (err) => Number(/, <anonymous>:(\d+):\d+\)/.exec(err?.stack)?.[1]) - 2 || undefined

async function exec(code, data, $vars, console) {
  let out
  try {
    out = await new AsyncFunction('data', '$vars', 'console', code)(data, $vars, console)
  } catch (err) {
    if (lineOf(err)) err.message = `Line ${lineOf(err)}: ${err.message}`
    throw err
  }
  if (out === undefined) return data
  if (out !== null && (typeof out !== 'object' || Array.isArray(out))) throw new Error('Code: return an object, or null to stop')
  return out
}

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
    const out = await exec(config.code, data, vars, console)
    if (JSON.stringify(vars) !== before) await saveVars() // the code changed a variable
    return out
  },
  // Test in its settings (CodeTest.jsx): runs the code once on that data and a copy of the variables (left as they
  // are), keeping what it logs. Answers { out, logs, ms } (out null: it stops there) or { error, logs, ms }.
  async test({ code, data }) {
    const logs = []
    const log = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, (...args) => logs.push({ level, text: format(...args) })]))
    const began = Date.now()
    try {
      const out = await exec(code, data ?? {}, structuredClone(vars), log)
      return { out, logs, ms: Date.now() - began }
    } catch (err) {
      return { error: err.message, logs, ms: Date.now() - began }
    }
  },
}
