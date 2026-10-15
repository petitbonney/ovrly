// Action: runs an action on a widget overlay (found by name or id), e.g. "vote" on a poll with value "{args}".
// Waits until the overlay has finished playing it (e.g. the wheel stopped), so the next nodes run after.
import { fill } from '../template.js'
import * as store from '../store.js'
import * as widgets from '../widgets.js'

export default {
  type: 'widget-update',
  label: 'Widget update',
  category: 'action',
  config: { widget: '', action: 'show', value: '{message}' },
  async run({ config, data }) {
    const widget = (await store.list('widgets')).find((w) => w.id === config.widget || w.name === config.widget)
    if (!widget) throw new Error(`Widget not found: ${config.widget}`)
    await widgets.update(widget, { action: config.action, value: fill(config.value, data), user: data.user }).done
    return data
  },
}
