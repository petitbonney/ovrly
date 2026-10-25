// Logic: lets data through, then blocks for a while; optionally also per value of a data key (e.g. per viewer).
// Blocked data goes to "blocked" with {{remaining}} seconds, e.g. to reply "on cooldown". Cooldowns live in memory:
// they reset when the server restarts.
const until = {} // node id (+ key value) -> time it lets data through again

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
    const value = config.byKey ? data[config.key] : undefined
    const keyId = value == null || value === '' ? null : `${id}/${value}`
    const left = Math.max((until[id] ?? 0) - Date.now(), keyId ? (until[keyId] ?? 0) - Date.now() : 0)
    if (left > 0) return { blocked: { ...data, remaining: Math.ceil(left / 1000) } }
    until[id] = Date.now() + config.seconds * 1000
    if (keyId) until[keyId] = Date.now() + config.keySeconds * 1000
    return { pass: data }
  },
}
