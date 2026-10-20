// Logic: runs another workflow, from its "Called By Workflow" trigger, with the current data. By default it waits for
// that workflow to finish, merges the data of its last node into this one's, and fails if it failed.
import * as store from '../store.js'

export default {
  type: 'execute-workflow',
  label: 'Execute Workflow',
  category: 'logic',
  group: 'Flow',
  description: 'Runs another workflow with the current data, and waits for its result.',
  fields: { workflow: { type: 'workflow' }, wait: { label: 'Wait for it to finish' } },
  config: { workflow: '', wait: true },
  async run({ config, data, signal, depth }) {
    if (depth >= 10) throw new Error('Execute Workflow: workflows call each other too deep')
    const target = (await store.list('workflows')).find((w) => w.id === config.workflow || w.name === config.workflow)
    if (!target) throw new Error(`Workflow not found: ${config.workflow}`)
    const { fire } = await import('../engine.js') // not imported on top: the engine loads this file
    const runs = fire(target, 'call', data, { signal, depth: depth + 1 })
    if (!config.wait) return data
    const [run] = await runs
    if (!run) throw new Error(`"${target.name}" has no Called By Workflow trigger`)
    if (run.error) throw new Error(`"${target.name}" failed: ${run.error.message}`)
    return { ...data, ...run.last }
  },
}
