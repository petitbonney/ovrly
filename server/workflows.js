// Saving and deleting workflows, with what follows: a workflow switched off stops what it runs, Merge Widgets pages
// follow their canvas, and the widget instances no workflow uses anymore are deleted.
import * as store from './store.js'
import { cancel } from './engine.js'
import * as merge from './merge.js'
import * as widgets from './widgets.js'

// A widget instance lives as long as its workflow node: once a workflow is saved or deleted, the widgets it referred to
// and no workflow uses anymore are deleted.
const widgetRefs = (workflow) => workflow?.nodes.filter((n) => n.data.type === 'widget').map((n) => n.data.config.widget) ?? []
async function dropUnusedWidgets(refs) {
  const used = new Set((await store.list('workflows')).flatMap(widgetRefs))
  for (const id of refs.filter((id) => id && !used.has(id))) await widgets.remove(id)
}

// Creates a workflow (no id), or updates one: merged over the saved one, so the editor's autosave keeps fields it
// doesn't send (e.g. enabled).
export async function save(workflow) {
  const old = workflow.id ? await store.get('workflows', workflow.id) : null
  const item = await store.save('workflows', { ...old, ...workflow })
  if (workflow.enabled === false) cancel(item.id) // switched off: stop what is running
  merge.push(item) // widgets moved on a Merge Widgets canvas
  await dropUnusedWidgets(widgetRefs(old))
  return item
}

export async function remove(id) {
  const old = await store.get('workflows', id)
  await store.remove('workflows', id)
  await dropUnusedWidgets(widgetRefs(old))
}
