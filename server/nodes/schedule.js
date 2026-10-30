// Trigger: fires every so often while its workflow is on, the first time one interval after it was turned on. The
// engine asks every second; the interval is kept in memory, so a restart starts it over. "While live" only counts
// while the stream is on: going live starts it over.
import { status as eventsub } from '../integrations/twitch-eventsub.js'

const state = {} // node id -> { due: when it fires next, tick: when it was last asked }

export default {
  type: 'schedule',
  label: 'Schedule',
  icon: 'clock',
  category: 'trigger',
  group: 'Other',
  description: 'Fires every so often while the workflow is on.',
  adds: ['time'],
  fields: {
    minutes: { label: 'Every', unit: 'min', presets: [1, 5, 15, 30, 60], hint: 'Decimals work, e.g. 0.5 for 30 s' },
    when: { label: 'Fires', options: [{ value: 'always', label: 'Always' }, { value: 'live', label: 'While live', streamer: true }] },
  },
  event: 'schedule',
  config: { minutes: 10, when: 'always' },
  manual: { event: () => ({ data: { now: true } }) },
  run({ config, data, id }) {
    if (data.now) return { time: new Date().toISOString() } // fired by hand: now, whatever the interval

    const interval = config.minutes * 60000
    if (!(interval >= 1000)) return null // a bad setting never fires
    if (config.when === 'live' && !eventsub.live) return null // not asked: starts over once live
    const now = Date.now()
    const s = (state[id] ??= {})
    if (!s.due || now - s.tick > 3000) s.due = now + interval // first time, or the workflow was off meanwhile
    s.tick = now
    if (now < s.due) return null
    s.due = now + interval
    return { time: new Date(now).toISOString() }
  },
}
