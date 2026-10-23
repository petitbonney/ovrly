// Trigger: a deck of buttons, each continuing on its own output. Its mode picks how they fire: Stream Deck keys
// paired with the Ovrly plugin (server/streamdeck.js fires this node alone), or Companion: a request to
// /hooks/deck/<slug>-<id>, from Companion or anything that sends HTTP (only the id counts, so renaming keeps old URLs working).
export default {
  type: 'deck',
  label: 'Control Pad',
  category: 'trigger',
  group: 'Other',
  description: 'One output per button, fired by a Stream Deck key (with the Ovrly plugin) or, with Companion, by a URL per button.',
  adds: ['button'],
  fields: {
    mode: {
      options: [{ value: 'companion', label: 'Companion' }, { value: 'streamdeck', label: 'Stream Deck', needs: 'streamdeck' }],
      hint: 'How the buttons fire',
      info: 'Companion: a URL per button, for Companion or anything that sends HTTP. Stream Deck: keys paired with the Ovrly plugin (Settings → Stream Deck).',
    },
    buttons: { type: 'deck' },
  },
  event: ['streamdeck', 'webhook'],
  outputsFrom: 'buttons', // one output per button, its id being the button's
  // mode: Stream Deck when the node is added while the plugin is connected. buttons: [{ id, icon, name, color }],
  // the id made at random when added.
  config: { mode: 'companion', buttons: [] },
  run({ config, data, event }) {
    const plugin = config.mode === 'streamdeck'
    if (plugin !== (event === 'streamdeck')) return null // each mode fires its own way only
    const [path, key] = plugin ? ['deck', data.button] : data.path.split('/')
    const button = path === 'deck' && config.buttons.find((b) => b.id === key?.split('-').at(-1))
    return button ? { [button.id]: plugin ? { ...data, button: button.name } : { ...data, button: button.name } } : null
  },
}
