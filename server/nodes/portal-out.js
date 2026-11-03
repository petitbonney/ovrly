// Logic: sends the data through a Portal In, in this workflow or another, which fires from there. Waiting, it gets
// back the data of the last node that ran there (and fails if that failed); else the flow ends here.
import * as store from '../store.js'
import portalIn from './portal-in.js'

// Node key -> when a firing that had already come through its Portal In went through it again, in the last 10s: more
// than 100 is a runaway loop.
const loops = {}

export default {
  type: 'portal-out',
  label: 'Portal Out',
  icon: 'portal-out', // server/icons/portal-out.svg
  category: 'logic',
  group: 'Flow',
  description: 'Sends the data through a Portal In, in this workflow or another.',
  fields: {
    target: { type: 'portal', label: 'Portal In' },
    wait: { label: 'Wait for it to finish', hint: 'Then continues with its result' },
  },
  config: { target: '', wait: false },
  output: { only: { wait: true } }, // no output port while it doesn't wait
  async run({ config, data, id, signal, depth, origins, fire }) {
    if (!config.target) throw new Error('Portal Out: pick a Portal In')
    const workflow = (await store.list('workflows')).find((w) => w.nodes.some((n) => n.id === config.target && n.data.type === portalIn.type))
    if (!workflow) throw new Error('Portal Out: its Portal In is gone, pick another one')
    if (origins.includes(`${workflow.id}/${config.target}`)) {
      const now = Date.now()
      loops[id] = [...(loops[id] ?? []).filter((at) => now - at < 10_000), now]
      if (loops[id].length > 100) throw new Error('Portal Out: looped more than 100 times in 10s, stopped')
    }
    // Waiting nests this firing's run inside the one that called it, so it counts towards the depth; going through
    // doesn't.
    if (!config.wait) {
      fire(workflow, portalIn.event, data, { signal, depth, origins }, config.target)
      return data
    }
    if (depth >= 10) throw new Error('Portal Out: portals wait on each other too deep')
    const [run] = await fire(workflow, portalIn.event, data, { signal, depth: depth + 1, origins }, config.target)
    if (run.error) throw new Error(`"${workflow.name}" failed: ${run.error.message}`)
    return { ...data, ...run.last }
  },
}
