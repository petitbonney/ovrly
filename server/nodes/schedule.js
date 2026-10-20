// Trigger: fires every so often while its workflow is on, the first time one interval after it was turned on. The
// engine asks every second; the interval is kept in memory, so a restart starts it over.
const unit = { seconds: 1, minutes: 60, hours: 3600 }
const state = {} // node id -> { due: when it fires next, tick: when it was last asked }

export default {
  type: 'schedule',
  label: 'Schedule',
  category: 'trigger',
  group: 'Other',
  description: 'Fires every so often while the workflow is on.',
  adds: ['time'],
  fields: { unit: { options: Object.keys(unit) } },
  event: 'schedule',
  config: { every: 10, unit: 'minutes' },
  run({ config, id }) {
    const interval = config.every * (unit[config.unit] ?? 0) * 1000
    if (!(interval >= 1000)) return null // a bad setting never fires
    const now = Date.now()
    const s = (state[id] ??= {})
    if (!s.due || now - s.tick > 3000) s.due = now + interval // first time, or the workflow was off meanwhile
    s.tick = now
    if (now < s.due) return null
    s.due = now + interval
    return { time: new Date(now).toISOString() }
  },
}
