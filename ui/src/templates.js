// Starter templates: import bundles (see share.js) with a name and a description.

// A "chat !command → widget action" workflow plus the widget it drives.
function command(name, description, command, widget, action, value) {
  return {
    name,
    description,
    widgets: [{ id: 'w', ...widget }],
    workflows: [{
      name,
      nodes: [
        { id: 'trigger', type: 'input', position: { x: 0, y: 0 }, data: { type: 'chat-command', label: 'Chat !command', config: { command } } },
        { id: 'action', type: 'default', position: { x: 0, y: 120 }, data: { type: 'widget-update', label: 'Widget update', config: { widget: 'w', action, value } } },
      ],
      edges: [{ id: 'e', source: 'trigger', target: 'action' }],
    }],
  }
}

export default [
  command('!spin → wheel', 'Spins a wheel when chat types !spin.', '!spin',
    { name: 'Spin wheel', type: 'wheel', config: {} }, 'spin', ''),
  command('Chat poll', 'Viewers vote with !vote 1 or !vote yes.', '!vote',
    { name: 'Poll', type: 'poll', config: {} }, 'vote', '{args}'),
  command('!hype alert', 'Shows a banner when someone types !hype.', '!hype',
    { name: 'Alerts', type: 'alerts', config: {} }, 'show', '{user} just ran !hype'),
]
