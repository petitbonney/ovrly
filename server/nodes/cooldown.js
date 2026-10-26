// Logic: lets data through, then blocks for a while; optionally also per value of a data key (e.g. per viewer).
// Blocked data goes to "blocked" with {{remaining}} seconds, e.g. to reply "on cooldown". Cooldowns live in memory:
// they reset when the server restarts. Its settings show the cooldowns running (`live`), each with a cross to drop it.
const cooldowns = {} // node id -> { until: time it lets data through again, keys: { [key value]: same, for that value } }

export default {
  type: 'cooldown',
  label: 'Cooldown',
  icon: 'clock-pause',
  category: 'logic',
  group: 'Timing',
  description: 'Lets data through, then sends the next to "blocked" for a while, for everyone and optionally per data key (e.g. per viewer).',
  fields: {
    seconds: { label: 'Global cooldown', unit: 's', presets: [5, 10, 30, 60, 300] },
    byKey: { label: 'Extra cooldown per key', hint: 'Also blocks the same value of a data key (e.g. user) for a while' },
    key: { type: 'var', label: 'Key', only: { byKey: true } },
    keySeconds: { label: 'Cooldown per key', unit: 's', presets: [5, 10, 30, 60, 300], only: { byKey: true } },
  },
  outputs: ['pass', 'blocked'],
  adds: ['remaining'],
  config: { seconds: 30, byKey: false, key: 'user', keySeconds: 60 },
  run({ config, data, id }) {
    const c = (cooldowns[id] ??= { until: 0, keys: {} })
    const value = config.byKey ? data[config.key] : undefined
    const keyed = value != null && value !== ''
    const left = Math.max(c.until, keyed ? c.keys[value] ?? 0 : 0) - Date.now()
    if (left > 0) return { blocked: { ...data, remaining: Math.ceil(left / 1000) } }
    c.until = Date.now() + config.seconds * 1000
    if (keyed) c.keys[value] = Date.now() + config.keySeconds * 1000
    return { pass: data }
  },
  // The cooldowns running, in ms left: { left (0: ready), keys: [{ key, left }] }.
  live(id) {
    const now = Date.now()
    const c = cooldowns[id] ?? { until: 0, keys: {} }
    for (const [key, t] of Object.entries(c.keys)) if (t <= now) delete c.keys[key] // over: forgotten
    return { left: Math.max(0, c.until - now), keys: Object.entries(c.keys).map(([key, t]) => ({ key, left: t - now })) }
  },
  // Drops a cooldown: the global one, or a key value's.
  control(id, action, key) {
    const c = cooldowns[id]
    if (!c || action !== 'drop') return false
    if (key == null) c.until = 0
    else delete c.keys[key]
    return true
  },
}
