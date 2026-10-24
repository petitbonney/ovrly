// Rewriting widget ids in pasted or imported nodes: widget nodes, and Merge Widgets placement.
import test from 'node:test'
import assert from 'node:assert/strict'
import { withWidgetIds } from '../ui/src/share.js'

test('widget ids are rewritten in widget nodes and Merge Widgets placement', () => {
  const nodes = [
    { id: 'a', data: { type: 'widget', config: { widget: 'old1' } } },
    { id: 'b', data: { type: 'widget', config: { widget: 'gone' } } },
    { id: 'm', data: { type: 'merge', config: { layout: { old1: { x: 0.1 }, gone: { x: 0.2 } }, order: ['gone', 'old1'] } } },
    { id: 'l', data: { type: 'log', config: { text: 'old1' } } },
  ]
  const out = withWidgetIds(nodes, { old1: 'new1' })
  assert.equal(out[0].data.config.widget, 'new1')
  assert.equal(out[1].data.config.widget, 'gone')
  assert.deepEqual(out[2].data.config, { layout: { new1: { x: 0.1 }, gone: { x: 0.2 } }, order: ['gone', 'new1'] })
  assert.equal(out[3], nodes[3])
})
