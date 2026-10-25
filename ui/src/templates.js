// Starter templates: import bundles (see share.js) with a name and a description. Each is one workflow, imported
// switched off: names in quotes (scenes, sources, rewards, the Discord webhook) and Hue lights are to set first.

// A node at column x, row y; its config only needs the settings that differ from its type's defaults.
const node = (id, type, x, y, config = {}) => ({ id, type: 'step', position: { x: x * 180, y: y * 140 }, data: { type, config } })
// A widget node for the template's widget of the same id.
const widget = (id, x, y) => node(id, 'widget', x, y, { widget: id })
// Links written "from>to", or "from:output>to" for a node with several outputs.
const links = (...list) => list.map((link, i) => {
  const [from, target] = link.split('>')
  const [source, sourceHandle] = from.split(':')
  return { id: `e${i + 1}`, source, target, ...(sourceHandle && { sourceHandle }) }
})
// A widget instance: its type, name, settings and the inputs of its start action (or of `action`).
const instance = (id, type, name, settings, input, action = 'start') => ({ id, type, state: { name, ...settings, input: input ? { [action]: input } : {} } })
const template = (name, description, nodes, edges, widgets = []) => ({ name, description, widgets, workflows: [{ name, enabled: false, nodes, edges }] })

// Hue routine steps: a color pulsing between full and low brightness.
const pulse = (color, ms) => [{ action: 'set', color, brightness: 100, duration: ms }, { action: 'set', color, brightness: 20, duration: ms }]

export default [
  // Basic
  template('Event alerts', 'Follows, subs, cheers and raids, each with its own text, shown one after another.', [
    node('follow', 'follow', 0, 0),
    node('sub', 'subscription', 0, 1, { kinds: ['sub', 'resub'] }),
    node('cheer', 'cheer', 0, 2),
    node('raid', 'raid', 0, 3),
    node('followText', 'edit-data', 1, 0, { values: [{ name: 'text', value: '{{user}} just followed!' }] }),
    node('subText', 'edit-data', 1, 1, { values: [{ name: 'text', value: "{{ kind === 'resub' ? user + ' resubscribed for ' + months + ' months!' : user + ' just subscribed!' }}" }] }),
    node('cheerText', 'edit-data', 1, 2, { values: [{ name: 'text', value: '{{user}} cheered {{bits}} bits!' }] }),
    node('raidText', 'edit-data', 1, 3, { values: [{ name: 'text', value: '{{user}} is raiding with {{viewers}} viewers!' }] }),
    widget('alerts', 2, 1.5),
  ], links('follow>followText', 'sub>subText', 'cheer>cheerText', 'raid>raidText',
    'followText>alerts', 'subText>alerts', 'cheerText>alerts', 'raidText>alerts'), [
    instance('alerts', 'alerts', 'Event alerts', { layout: 'flap', duration: 6 }, { text: '{{text}}' }),
  ]),

  template('Last follower', 'Keeps the last follower on screen.', [
    node('follow', 'follow', 0, 0),
    widget('label', 1, 0),
  ], links('follow>label'), [
    instance('label', 'label', 'Last follower', { size: 36 }, { text: 'Last follower: {{user}}' }),
  ]),

  template('!roll dice', 'Chat rolls a die with !roll, once a minute per viewer; rolls wait their turn.', [
    node('command', 'chat-command', 0, 0, { command: '!roll' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 5, byKey: true, key: 'user', keySeconds: 60 }),
    node('queue', 'queue', 2, 0),
    widget('dice', 3, 0),
    widget('alert', 4, 0),
  ], links('command>cooldown', 'cooldown:pass>queue', 'queue>dice', 'dice>alert'), [
    instance('dice', 'dice', 'Dice'),
    instance('alert', 'alerts', 'Roll result', { layout: 'arcade', duration: 4 }, { text: '{{user}} rolled a {{winner}}!' }),
  ]),

  template('!sound soundboard', 'Chat plays a MyInstants sound with !sound airhorn (no word: a trending one).', [
    node('command', 'chat-command', 0, 0, { command: '!sound' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 10, byKey: true, key: 'user', keySeconds: 120 }),
    node('search', 'myinstants', 2, 0, { pick: 'random', search: "{{ args.join(' ') }}" }),
    widget('sound', 3, 0),
  ], links('command>cooldown', 'cooldown:pass>search', 'search>sound'), [
    instance('sound', 'sound', 'Soundboard', { duration: 8, volume: 60 }, { sound: '{{sound}}' }),
  ]),

  template('!gif on screen', 'Chat shows a GIPHY GIF with !gif cats (no word: a trending one).', [
    node('command', 'chat-command', 0, 0, { command: '!gif' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 15, byKey: true, key: 'user', keySeconds: 120 }),
    node('search', 'giphy', 2, 0, { pick: 'random', search: "{{ args.join(' ') }}" }),
    widget('image', 3, 0),
  ], links('command>cooldown', 'cooldown:pass>search', 'search>image'), [
    instance('image', 'image', 'Chat GIF', { duration: 6 }, { image: '{{gif}}' }),
  ]),

  template('Chat reminders', 'Every 15 minutes while live, announces the next of three messages, in turn.', [
    node('every', 'schedule', 0, 0, { minutes: 15, when: 'live' }),
    node('next', 'edit-variable', 1, 0, { name: 'reminder', operation: 'set', value: '{{ (Number($vars.reminder) || 0) % 3 + 1 }}' }),
    node('message', 'map-value', 2, 0, { key: 'value', map: [
      { from: '1', to: 'Enjoying the stream? Hit Follow to know when I go live!' },
      { from: '2', to: 'Join the community Discord: discord.gg/your-invite' },
      { from: '3', to: 'Try the chat commands: !roll, !sound, !gif' },
    ] }),
    node('announce', 'twitch-announce', 3, 0, { message: '{{value}}', color: 'purple' }),
  ], links('every>next', 'next>message', 'message>announce')),

  // Everyday stream tools
  template('Death counter', 'Control Pad buttons count deaths on screen; chat asks with !deaths.', [
    node('pad', 'deck', 0, 0, { buttons: [
      { id: 'add', icon: 'skull', name: 'Death +1', color: '#e03131' },
      { id: 'undo', icon: 'arrow-back-up', name: 'Undo', color: '#ffb400' },
      { id: 'reset', icon: 'refresh', name: 'Reset', color: '#3d8bff' },
    ] }),
    node('add', 'edit-variable', 1, -1, { name: 'deaths', operation: 'add', value: '1' }),
    node('undo', 'edit-variable', 1, 0, { name: 'deaths', operation: 'set', value: '{{ Math.max(0, (Number($vars.deaths) || 0) - 1) }}' }),
    node('reset', 'edit-variable', 1, 1, { name: 'deaths', operation: 'set', value: '0' }),
    widget('label', 2, 0),
    node('command', 'chat-command', 0, 2, { command: '!deaths' }),
    node('reply', 'twitch-chat', 1, 2, { message: 'Deaths so far: {{ $vars.deaths || 0 }}', replyTo: '{{messageId}}' }),
  ], links('pad:add>add', 'pad:undo>undo', 'pad:reset>reset', 'add>label', 'undo>label', 'reset>label', 'command>reply'), [
    instance('label', 'label', 'Death counter', {}, { text: 'Deaths: {{value}}' }),
  ]),

  template('!clip for VIPs', 'VIPs and mods clip the moment with !clip, marked in the VOD; the link goes to chat.', [
    node('command', 'chat-command', 0, 0, { command: '!clip', from: 'vip' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 60 }),
    node('clip', 'twitch-clip', 2, 0),
    node('marker', 'twitch-marker', 2, 1, { description: '!clip by {{user}}' }),
    node('wait', 'delay', 3, 0, { seconds: 5 }),
    node('link', 'twitch-chat', 4, 0, { message: 'Clip by {{user}}: {{clipUrl}}' }),
    node('blocked', 'twitch-chat', 2, 2, { message: '!clip is on cooldown, try again in {{remaining}}s', replyTo: '{{messageId}}' }),
  ], links('command>cooldown', 'cooldown:pass>clip', 'cooldown:pass>marker', 'clip>wait', 'wait>link', 'cooldown:blocked>blocked')),

  template('Raid welcome', 'A raid of 3 viewers or more gets a shoutout, an announcement and an alert.', [
    node('raid', 'raid', 0, 0, { minViewers: 3 }),
    node('info', 'twitch-user', 1, 0),
    node('shoutout', 'twitch-shoutout', 2, -1, { channel: '{{login}}' }),
    node('announce', 'twitch-announce', 2, 0, { message: 'Welcome {{user}} and their {{viewers}} raiders! They were playing {{game}}: twitch.tv/{{login}}', color: 'green' }),
    widget('alert', 2, 1),
  ], links('raid>info', 'info>shoutout', 'info>announce', 'info>alert'), [
    instance('alert', 'alerts', 'Raid alert', { layout: 'trophy', duration: 8 }, { text: '{{user}} is raiding with {{viewers}} viewers!' }),
  ]),

  template('Gift sub bomb', 'Thanks the gifter in chat and welcomes each recipient on screen, one after another.', [
    node('gift', 'gift-subs', 0, 0),
    node('thanks', 'twitch-chat', 1, 0, { message: "Thank you {{user}} for gifting {{ count === 1 ? 'a sub' : count + ' subs' }}!" }),
    node('each', 'fan-out', 1, 1, { list: '{{recipients}}' }),
    widget('alert', 2, 1),
  ], links('gift>thanks', 'gift>each', 'each>alert'), [
    instance('alert', 'alerts', 'Gift welcome', { layout: 'ticket', duration: 4 }, { text: 'Welcome {{item}}, gifted by {{user}}!' }),
  ]),

  template('BRB + ad break', 'A Control Pad button warns chat, then runs a 90 s ad on the "BRB" scene and switches back.', [
    node('pad', 'deck', 0, 0, { buttons: [{ id: 'brb', icon: 'coffee', name: 'BRB', color: '#ff7a00' }] }),
    node('warn', 'twitch-announce', 1, 0, { message: 'Quick break! Ads start in 30 seconds, back in about 2 minutes.', color: 'orange' }),
    node('wait', 'delay', 2, 0, { seconds: 30 }),
    node('ad', 'twitch-ad', 3, -0.5, { length: 90 }),
    node('scene', 'obs-scene', 3, 0.5, { scene: 'BRB', back: 90 }),
  ], links('pad:brb>warn', 'warn>wait', 'wait>ad', 'wait>scene')),

  template('Going live', 'Going live sets the lights and posts the stream to a Discord webhook; ending turns the lights off.', [
    node('stream', 'stream-status', 0, 0),
    node('status', 'switch', 1, 0, { value: '{{status}}', cases: ['online', 'offline'] }),
    node('lights', 'hue', 2, -1, { mode: 'set', color: '#9147ff', brightness: 80 }),
    node('wait', 'delay', 2, 0, { seconds: 20 }), // Twitch takes a moment to list the stream
    node('info', 'twitch-channel-info', 3, 0),
    node('discord', 'http-request', 4, 0, {
      url: 'https://discord.com/api/webhooks/your-webhook',
      body: "{{ JSON.stringify({ content: 'Live now: ' + title + ' (' + game + ') https://twitch.tv/' + $vars.channel }) }}",
    }),
    node('off', 'hue', 2, 1, { mode: 'off' }),
  ], links('stream>status', 'status:1>lights', 'status:1>wait', 'wait>info', 'info>discord', 'status:2>off')),

  // Engagement and games
  template('Chat poll', 'Mods start the poll with !poll; chat votes with !vote 1 or !vote yes; the result is announced.', [
    node('poll', 'chat-command', 0, 0, { command: '!poll', from: 'mod' }),
    node('vote', 'chat-command', 0, 1, { command: '!vote' }),
    node('count', 'widget-action', 1, 1, { action: 'vote', input: { option: '{{args.0}}', user: '{{user}}' } }),
    widget('voting', 2, 0),
    node('result', 'twitch-announce', 3, 0, { message: 'Poll closed: {{winner}} wins ({{votes}} votes)' }),
  ], links('poll>voting', 'vote>count', 'count>voting', 'voting>result'), [
    instance('voting', 'voting', 'Chat poll', { title: 'Who wins?', options: ['Yes', 'No'], duration: 60 }),
  ]),

  template('Channel points wheel', 'Redeeming "Spin the wheel" spins a wheel of challenges; spins wait their turn.', [
    node('redeem', 'redeem', 0, 0, { reward: 'Spin the wheel' }),
    node('queue', 'queue', 1, 0),
    widget('wheel', 2, 0),
    node('result', 'twitch-chat', 3, 0, { message: '{{user}} spun the wheel: {{winner}}!' }),
  ], links('redeem>queue', 'queue>wheel', 'wheel>result'), [
    instance('wheel', 'lottery', 'Wheel of fortune', { duration: 6, options: [
      { label: 'Hydrate!', weight: 1 },
      { label: 'Sing a song', weight: 1 },
      { label: '10 push-ups', weight: 1 },
      { label: 'Chat picks the next game', weight: 1 },
      { label: 'Nothing, lucky you', weight: 2 },
    ] }),
  ]),

  template('Twitch Plays', 'Chat plays the game: up, down, a, b… become key presses. Set the game window on Key Press.', [
    node('pad', 'deck', 0, 0, { buttons: [
      { id: 'start', icon: 'player-play', name: 'Start', color: '#2f9e44' },
      { id: 'stop', icon: 'player-stop', name: 'Stop', color: '#e03131' },
    ] }),
    node('start', 'widget-action', 1, -0.5, { action: 'start' }),
    node('stop', 'widget-action', 1, 0.5),
    node('chat', 'chat-message', 1, 1.5),
    widget('plays', 2, 0.5),
    node('keys', 'key-press', 3, 0.5, { keys: '{{keys}}' }),
  ], links('pad:start>start', 'pad:stop>stop', 'start>plays', 'stop>plays', 'chat>plays', 'plays>keys'), [
    instance('plays', 'twitch-plays', 'Twitch Plays', {}, { text: '{{message}}', user: '{{user}}' }, 'push'),
  ]),

  // Original
  template('Bits chaos roulette', 'A 100+ bits cheer spins a slot of challenges; some toggle OBS sources for a minute.', [
    node('cheer', 'cheer', 0, 0, { minBits: 100 }),
    node('queue', 'queue', 1, 0),
    widget('slot', 2, 0),
    widget('alert', 3, -1),
    node('pick', 'switch', 3, 0.5, { value: '{{winner}}', cases: ['Mirror cam', 'Mute music'] }),
    node('mirror', 'obs-source', 4, 0, { scene: 'Main', source: 'Mirrored camera', visible: 'show' }),
    node('mirrorWait', 'delay', 5, 0, { seconds: 60 }),
    node('unmirror', 'obs-source', 6, 0, { scene: 'Main', source: 'Mirrored camera', visible: 'hide' }),
    node('mute', 'obs-source', 4, 1, { scene: 'Main', source: 'Music', visible: 'hide' }),
    node('muteWait', 'delay', 5, 1, { seconds: 60 }),
    node('unmute', 'obs-source', 6, 1, { scene: 'Main', source: 'Music', visible: 'show' }),
  ], links('cheer>queue', 'queue>slot', 'slot>alert', 'slot>pick', 'pick:1>mirror', 'mirror>mirrorWait', 'mirrorWait>unmirror',
    'pick:2>mute', 'mute>muteWait', 'muteWait>unmute'), [
    instance('slot', 'lottery', 'Chaos roulette', { layout: 'slots', duration: 5, options: [
      { label: 'Mirror cam', weight: 1 },
      { label: 'Mute music', weight: 1 },
      { label: '10 squats', weight: 1 },
      { label: 'Talk like a pirate', weight: 1 },
    ] }),
    instance('alert', 'alerts', 'Chaos alert', { layout: 'neon', duration: 5 }, { text: "{{user}}'s bits picked: {{winner}}" }),
  ]),

  template('Hype Train mood', 'A Hype Train pulses the lights and shows its level; its end celebrates in gold and in chat.', [
    node('train', 'hype-train', 0, 0),
    node('phase', 'switch', 1, 0, { value: '{{phase}}', cases: ['begin', 'progress', 'end'] }),
    node('pulse', 'hue', 2, -1, { mode: 'routine', steps: [...pulse('#9147ff', 600), ...pulse('#ff4f8b', 600)], loop: 'times', times: 10 }),
    widget('label', 3, 0),
    node('hide', 'widget-action', 2, 1),
    node('gold', 'hue', 2, 2, { mode: 'routine', steps: pulse('#ffb400', 400), loop: 'times', times: 5 }),
    node('thanks', 'twitch-announce', 2, 3, { message: 'The Hype Train reached level {{level}}! Top conductor: {{top}}. Thank you all!', color: 'purple' }),
  ], links('train>phase', 'phase:1>pulse', 'phase:1>label', 'phase:2>label', 'phase:3>hide', 'hide>label', 'phase:3>gold', 'phase:3>thanks'), [
    instance('label', 'label', 'Hype Train', {}, { text: 'Hype Train level {{level}}: {{ Math.round(progress / goal * 100) || 0 }}%' }),
  ]),

  template('Link guard', 'Deletes links from viewers who have followed for less than a week, with a 60 s timeout.', [
    node('chat', 'chat-message', 0, 0),
    node('link', 'filter', 1, 0, { value: '{{message}}', operator: 'matches', compare: 'https?://|www\\.|\\b[a-z0-9-]+\\.(com|net|org|gg|tv|io|ly)\\b' }),
    node('viewer', 'filter', 2, 0, { value: '{{ mod || vip || broadcaster }}', operator: 'equals', compare: 'false' }),
    node('info', 'twitch-user', 3, 0),
    node('new', 'filter', 4, 0, { value: '{{ followDays >= 7 }}', operator: 'equals', compare: 'false' }),
    node('delete', 'twitch-delete-message', 5, -1),
    node('timeout', 'twitch-ban', 5, 0, { reason: 'Link before following for a week' }),
    node('warn', 'twitch-chat', 5, 1, { message: '@{{user}} links are for followers of a week or more. Ask a mod to share one.' }),
  ], links('chat>link', 'link>viewer', 'viewer>info', 'info>new', 'new>delete', 'new>timeout', 'new>warn')),
]
