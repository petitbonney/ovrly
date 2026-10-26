// Logic: waits before passing data on. Its settings show the firings waiting (`live`), with Force and Cancel.
const waiting = {} // node id -> Set of { data, until, end(go) }
export default {
  type: 'delay',
  label: 'Delay',
  icon: 'hourglass',
  category: 'logic',
  group: 'Timing',
  description: 'Waits before passing data on.',
  fields: { seconds: { label: 'Delay', unit: 's', presets: [1, 3, 5, 10, 30] } },
  config: { seconds: 1 },
  async run({ config, data, id, signal }) {
    const set = (waiting[id] ??= new Set())
    let entry
    const go = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), config.seconds * 1000)
      entry = { data, until: Date.now() + config.seconds * 1000, end: (go) => { clearTimeout(timer); resolve(go) } }
      set.add(entry)
      signal.addEventListener('abort', () => entry.end(false), { once: true }) // workflow cancelled
    })
    set.delete(entry)
    return go ? data : null
  },
  // The firings waiting, first in first: [{ data, left }] with left in ms.
  live: (id) => [...(waiting[id] ?? [])].map(({ data, until }) => ({ data, left: until - Date.now() })),
  // Force: the firings waiting go on now; Cancel: they stop there.
  control(id, action) {
    if (!waiting[id]?.size) return false
    for (const entry of waiting[id]) entry.end(action === 'force')
    return true
  },
}
