// Workflow variables (read as {{ $vars.name }}): name -> value, kept in memory and saved to ./data/settings/vars.json.
import * as store from './store.js'

export const vars = (await store.get('settings', 'vars'))?.values ?? {}

// Saves are queued, so two nodes changing variables at once don't write the file at the same time.
let saving = Promise.resolve()
export const saveVars = () => (saving = saving.catch(() => {}).then(() => store.save('settings', { id: 'vars', values: vars })))
