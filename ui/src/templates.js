// Starter templates: import bundles (see share.js) with a name and a description.

// A "chat !command → widget" workflow with its widget instance: the widget node runs the widget's main action with
// `value`. With `action`, a Widget Callback node runs that action instead, and a Manual Trigger runs the main one.
function command(name, description, command, widget, value, action) {
  const trigger = { id: 'trigger', type: 'step', position: { x: 0, y: 0 }, data: { type: 'chat-command', label: 'Chat !command', config: { command } } }
  const node = (y) => ({ id: 'widget', type: 'step', position: { x: 240, y }, data: { type: 'widget', label: 'Widget', config: { widget: 'w', value: action ? '' : value } } })
  const workflow = action ? {
    nodes: [
      trigger,
      { id: 'callback', type: 'step', position: { x: 240, y: 0 }, data: { type: 'widget-callback', label: 'Widget Callback', config: { widget: 'w', action, value } } },
      { id: 'manual', type: 'step', position: { x: 0, y: 160 }, data: { type: 'manual', label: 'Manual Trigger', config: {} } },
      node(160),
    ],
    edges: [{ id: 'e', source: 'trigger', target: 'callback' }, { id: 'm', source: 'manual', target: 'widget' }],
  } : { nodes: [trigger, node(0)], edges: [{ id: 'e', source: 'trigger', target: 'widget' }] }
  return { name, description, widgets: [{ id: 'w', ...widget }], workflows: [{ name, ...workflow }] }
}

export default [
  command('!spin → lottery', 'Spins a lottery wheel when chat types !spin.', '!spin',
    { name: 'Lottery', type: 'lottery', config: {} }, ''),
  command('Chat poll', 'Run it to start the poll; viewers vote with !vote 1 or !vote yes.', '!vote',
    { name: 'Poll', type: 'poll', config: {} }, '{{args}}', 'vote'),
  command('!hype alert', 'Shows a banner when someone types !hype.', '!hype',
    { name: 'Alerts', type: 'alerts', config: {} }, '{{user}} just ran !hype'),
]
