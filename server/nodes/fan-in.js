// Logic: the mirror of Fan Out. Collects several firings into one list, then goes on once with { items, count }.
// The first firing waits here; the others add their entry and stop. It releases at the first condition met: a
// duration from the first entry, a quiet period with no new event, or a limit of entries. Buckets live in memory.
import { value } from '../template.js'

const buckets = {} // node id -> { entries: Map key -> item, release(), timer, quiet }

export default {
  type: 'fan-in',
  label: 'Fan In',
  category: 'logic',
  group: 'Flow',
  description: 'Collects several firings into one list, released after a duration, a quiet period or a limit of entries.',
  fields: {
    duration: { label: 'Duration', unit: 's', presets: [0, 5, 10, 30, 60], off: true, hint: 'Released this long after the first entry' },
    quiet: { label: 'Quiet period', unit: 's', presets: [0, 2, 5, 10, 30], off: true, hint: 'Released once no event came for this long' },
    limit: { label: 'Limit', presets: [5, 10, 25, 50, 0], off: true, hint: 'Released as soon as it holds this many entries' },
    item: { vars: true, label: 'Entry', hint: 'What each entry holds, e.g. {{user}}; empty for the whole data. After this node, {{ $node... }} still reads the first firing.' },
    byKey: { label: 'One entry per key', hint: 'Keeps one entry per value of a data key (e.g. one per viewer)' },
    key: { type: 'var', label: 'Key', only: { byKey: true } },
    keep: { label: 'Keep', options: ['first', 'last'], only: { byKey: true } },
  },
  adds: ['items', 'count'],
  config: { duration: 10, quiet: 0, limit: 0, item: '', byKey: false, key: 'user', keep: 'first' },
  async run({ config, data, id, signal }) {
    const { duration, quiet, limit } = config
    if (!(duration > 0 || quiet > 0 || limit > 0)) throw new Error('Fan In: set a duration, a quiet period or a limit')
    let bucket = buckets[id]
    let released
    if (!bucket) {
      bucket = buckets[id] = { entries: new Map() }
      released = new Promise((resolve) => {
        bucket.release = () => {
          if (buckets[id] === bucket) delete buckets[id] // the next event opens a new bucket
          clearTimeout(bucket.timer)
          clearTimeout(bucket.quiet)
          resolve()
        }
      })
      if (duration > 0) bucket.timer = setTimeout(bucket.release, duration * 1000)
      signal.addEventListener('abort', bucket.release, { once: true }) // workflow cancelled: the bucket is dropped
    }
    // Without a key, every entry counts; a repeated key keeps its slot (Map order), with the first or last entry.
    const keyValue = config.byKey ? data[config.key] : undefined
    const key = keyValue == null || keyValue === '' ? Symbol() : keyValue
    if (!bucket.entries.has(key) || config.keep === 'last') bucket.entries.set(key, config.item.trim() ? value(config.item, data) : { ...data })
    if (quiet > 0) {
      clearTimeout(bucket.quiet)
      bucket.quiet = setTimeout(bucket.release, quiet * 1000)
    }
    if (limit > 0 && bucket.entries.size >= limit) bucket.release()
    if (!released) return null // collected: the first firing carries the list on
    await released
    if (signal.aborted) return null
    const items = [...bucket.entries.values()]
    return { items, count: items.length }
  },
}
