// Starter templates: import bundles (see share.js) with a name and a description.

// A "chat !command → Fire Widget" workflow plus the widget node (and instance) it drives, linked by their diamonds.
function command(name, description, command, widget, action, value) {
  return {
    name,
    description,
    widgets: [{ id: 'w', ...widget }],
    workflows: [{
      name,
      nodes: [
        { id: 'trigger', type: 'step', position: { x: 0, y: 0 }, data: { type: 'chat-command', label: 'Chat !command', config: { command } } },
        { id: 'action', type: 'step', position: { x: 240, y: 0 }, data: { type: 'fire-widget', label: 'Fire Widget', config: { action, value } } },
        { id: 'widget', type: 'step', position: { x: 240, y: 200 }, data: { type: 'widget', label: 'Widget', config: { widget: 'w' } } },
      ],
      edges: [
        { id: 'e', source: 'trigger', target: 'action' },
        { id: 'link', source: 'widget', sourceHandle: 'widget', target: 'action', targetHandle: 'widget' },
      ],
    }],
  }
}

export default [
  command('!spin → lottery', 'Spins a lottery wheel when chat types !spin.', '!spin',
    { name: 'Lottery', type: 'lottery', config: {} }, 'spin', ''),
  command('Chat poll', 'Viewers vote with !vote 1 or !vote yes.', '!vote',
    { name: 'Poll', type: 'poll', config: {} }, 'vote', '{{args}}'),
  command('!hype alert', 'Shows a banner when someone types !hype.', '!hype',
    { name: 'Alerts', type: 'alerts', config: {} }, 'show', '{{user}} just ran !hype'),
]
