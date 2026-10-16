// Logic: lets data through, then blocks for a while, for everyone or per viewer. Blocked data goes to "blocked" with
// {{remaining}} seconds, e.g. to reply "on cooldown". Cooldowns live in memory: they reset when the server restarts.
const until = {} // node id (+ user) -> time it lets data through again

export default {
  type: 'cooldown',
  label: 'Cooldown',
  category: 'logic',
  description: 'Lets data through, then sends the next to "blocked" for a while: for everyone, or per viewer.',
  fields: { seconds: { label: 'Cooldown', unit: 's' }, per: { options: ['everyone', 'viewer'] } },
  outputs: ['pass', 'blocked'],
  adds: ['remaining'],
  config: { seconds: 30, per: 'everyone' },
  run({ config, data, id }) {
    const key = config.per === 'viewer' ? `${id}/${data.user ?? ''}` : id
    const left = (until[key] ?? 0) - Date.now()
    if (left > 0) return { blocked: { ...data, remaining: Math.ceil(left / 1000) } }
    until[key] = Date.now() + config.seconds * 1000
    return { pass: data }
  },
}
