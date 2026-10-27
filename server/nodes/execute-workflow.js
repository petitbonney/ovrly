// Logic: runs another workflow, from one of its "Called By Workflow" triggers, with the current data. By default it waits
// for that workflow to finish, merges the data of its last node into this one's, and fails if it failed.
import * as store from '../store.js'
import call from './workflow-call.js'

export default {
  type: 'execute-workflow',
  label: 'Execute Workflow',
  icon: 'subtask',
  category: 'logic',
  group: 'Flow',
  description: 'Runs another workflow with the current data, and waits for its result.',
  fields: { workflow: { type: 'workflow' }, wait: { label: 'Wait for it to finish' } },
  config: { workflow: '', wait: true },
  async run({ config, data, signal, depth, origins, fire }) {
    if (depth >= 10) throw new Error('Execute Workflow: workflows call each other too deep')
    // "<workflow id>/<trigger ID>"; a bare workflow id (older nodes) runs all its Called By Workflow triggers.
    const [id, callId] = config.workflow.split(/\/(.*)/)
    const target = (await store.list('workflows')).find((w) => w.id === id || w.name === id)
    if (!target) throw new Error(`Workflow not found: ${id}`)
    const trigger = callId && target.nodes.find((n) => n.data.type === call.type && { ...call.config, ...n.data.config }.id === callId)
    if (callId && !trigger) throw new Error(`"${target.name}" has no Called By Workflow trigger with ID "${callId}"`)
    const runs = fire(target, 'call', data, { signal, depth: depth + 1, origins }, trigger?.id)
    if (!config.wait) return data
    const [run] = await runs
    if (!run) throw new Error(`"${target.name}" has no Called By Workflow trigger`)
    if (run.error) throw new Error(`"${target.name}" failed: ${run.error.message}`)
    return { ...data, ...run.last }
  },
}
