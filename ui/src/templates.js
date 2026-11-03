// Starter templates: import bundles (see share.js) with a name and a description. Each is one workflow, imported
// switched off: names in quotes (scenes, sources, rewards, the Discord webhook) and Hue lights are to set first.
import layout from './layout.js'

// A node at column x, row y (a sketch: imports are arranged, see arranged, keeping the triggers' top-to-bottom order);
// its config only needs the settings that differ from its type's defaults.
const node = (id, type, x, y, config = {}) => ({ id, type: 'step', position: { x: x * 160, y: y * 160 }, data: { type, config } })
// A widget node for the template's widget of the same id, with the action ports it shows besides its main one.
const widget = (id, x, y, ports = []) => node(id, 'widget', x, y, { widget: id, ports })
// Links written "from>to", "from:output>to" for a node with several outputs, "from>to:port" into a widget node's action
// port.
const links = (...list) => list.map((link, i) => {
  const [from, to] = link.split('>')
  const [source, sourceHandle] = from.split(':')
  const [target, targetHandle] = to.split(':')
  return { id: `e${i + 1}`, source, target, ...(sourceHandle && { sourceHandle }), ...(targetHandle && { targetHandle }) }
})
// A widget instance: its type, name, settings and its actions' inputs ({ start: { text } }).
const instance = (id, type, name, settings, input = {}) => ({ id, type, state: { name, ...settings, input } })
const template = (name, description, nodes, edges, widgets = []) => ({ name, description, widgets, workflows: [{ name, enabled: false, nodes, edges }] })

// A template with its workflows laid out as the editor's Arrange does (layout.js), so it opens tidy. defs: node types.
export const arranged = (t, defs) => ({ ...t, workflows: t.workflows.map((w) => {
  const at = layout(w.nodes, w.edges, defs)
  return { ...w, nodes: w.nodes.map((n) => ({ ...n, position: at[n.id] })) }
}) })

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
    node('subText', 'edit-data', 1, 1, { values: [{ name: 'text', value: "{{ subKind === 'resub' ? user + ' resubscribed for ' + subMonths + ' months!' : user + ' just subscribed!' }}" }] }),
    node('cheerText', 'edit-data', 1, 2, { values: [{ name: 'text', value: '{{user}} cheered {{bits}} bits!' }] }),
    node('raidText', 'edit-data', 1, 3, { values: [{ name: 'text', value: '{{user}} is raiding with {{raidViewers}} viewers!' }] }),
    widget('alerts', 2, 1.5),
  ], links('follow>followText', 'sub>subText', 'cheer>cheerText', 'raid>raidText',
    'followText>alerts', 'subText>alerts', 'cheerText>alerts', 'raidText>alerts'), [
    instance('alerts', 'alerts', 'Event alerts', { layout: 'flap', duration: 6 }, { start: { text: '{{text}}' } }),
  ]),

  template('Cheer to speech', 'A 100+ bits cheer is read aloud, bad words bleeped, with an alert; cheers wait their turn.', [
    node('cheer', 'cheer', 0, 0, { minBits: 100 }),
    node('words', 'word-filter', 1, 0, { mask: 'text', text: 'bleep' }),
    node('queue', 'queue', 2, 0),
    node('speech', 'speech', 3, 0, { text: '{{user}} cheered {{bits}} bits. {{message}}' }),
    widget('sound', 4, -0.5),
    widget('alert', 4, 0.5),
  ], links('cheer>words', 'words>queue', 'queue>speech', 'speech>sound', 'speech>alert'), [
    instance('sound', 'sound', 'Cheer speech', {}, { start: { sound: '{{sound}}' } }),
    instance('alert', 'alerts', 'Cheer alert', { duration: 8 }, { start: { text: '{{user}} cheered {{bits}} bits: {{message}}' } }),
  ]),

  template('!roll dice', 'Chat rolls a die with !roll, once a minute per viewer; rolls wait their turn.', [
    node('command', 'chat-command', 0, 0, { command: '!roll' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 5, byKey: true, key: 'user', keySeconds: 60 }),
    node('queue', 'queue', 2, 0),
    widget('dice', 3, 0),
    widget('alert', 4, 0),
  ], links('command>cooldown', 'cooldown:pass>queue', 'queue>dice', 'dice>alert'), [
    instance('dice', 'dice', 'Dice'),
    instance('alert', 'alerts', 'Roll result', { layout: 'arcade', duration: 4 }, { start: { text: '{{user}} rolled a {{winner}}!' } }),
  ]),

  template('!sound soundboard', 'Chat plays a MyInstants sound with !sound airhorn (no word: a trending one).', [
    node('command', 'chat-command', 0, 0, { command: '!sound' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 10, byKey: true, key: 'user', keySeconds: 120 }),
    node('search', 'myinstants', 2, 0, { pick: 'random', search: "{{ args.join(' ') }}" }),
    widget('sound', 3, 0),
  ], links('command>cooldown', 'cooldown:pass>search', 'search>sound'), [
    instance('sound', 'sound', 'Soundboard', { duration: 8, volume: 60 }, { start: { sound: '{{sound}}' } }),
  ]),

  template('!gif on screen', 'Chat shows a GIPHY GIF with !gif cats (no word: a trending one).', [
    node('command', 'chat-command', 0, 0, { command: '!gif' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 15, byKey: true, key: 'user', keySeconds: 120 }),
    node('search', 'giphy', 2, 0, { pick: 'random', search: "{{ args.join(' ') }}" }),
    widget('image', 3, 0),
  ], links('command>cooldown', 'cooldown:pass>search', 'search>image'), [
    instance('image', 'image', 'Chat GIF', { duration: 6 }, { start: { image: '{{giphyUrl}}' } }),
  ]),

  template('Chat reminders', 'Every 15 minutes while live, announces the next of three messages, in turn.', [
    node('every', 'schedule', 0, 0, { minutes: 15, when: 'live' }),
    node('next', 'edit-variable', 1, 0, { name: 'reminder', operation: 'set', value: '{{ (Number($vars.reminder) || 0) % 3 + 1 }}' }),
    node('message', 'map-value', 2, 0, { key: 'value', map: [
      { from: '1', to: 'Enjoying the stream? Hit Follow to know when I go live!' },
      { from: '2', to: 'Join the community Discord: discord.gg/your-invite' },
      { from: '3', to: 'Try the chat commands: !roll, !sound, !gif' },
    ] }),
    node('announce', 'twitch-announce', 3, 0, { message: '{{variableValue}}', color: 'purple' }),
  ], links('every>next', 'next>message', 'message>announce')),

  // Everyday stream tools
  template('Death counter', 'Control Pad buttons count deaths on screen, with the time since the last; chat asks with !deaths.', [
    node('pad', 'deck', 0, 0, { buttons: [
      { id: 'add', icon: 'skull', name: 'Death +1', color: '#e03131' },
      { id: 'undo', icon: 'arrow-back-up', name: 'Undo', color: '#ffb400' },
      { id: 'reset', icon: 'refresh', name: 'Reset', color: '#3d8bff' },
    ] }),
    node('add', 'edit-variable', 1, -1, { name: 'deaths', operation: 'add', value: '1' }),
    node('undo', 'edit-variable', 1, 0, { name: 'deaths', operation: 'set', value: '{{ Math.max(0, (Number($vars.deaths) || 0) - 1) }}' }),
    node('reset', 'edit-variable', 1, 1, { name: 'deaths', operation: 'set', value: '0' }),
    widget('label', 2, 0),
    // A death resets the timer, then starts it a second later (at once, the start could come first).
    node('wait', 'delay', 2, 1.5),
    widget('timer', 3, 1.5, ['reset']),
    node('command', 'chat-command', 0, 2, { command: '!deaths' }),
    node('reply', 'twitch-chat', 1, 2, { message: 'Deaths so far: {{ $vars.deaths || 0 }}', replyTo: '{{messageId}}' }),
  ], links('pad:add>add', 'pad:undo>undo', 'pad:reset>reset', 'add>label', 'undo>label', 'reset>label', 'add>timer:reset', 'add>wait',
    'reset>timer:reset', 'wait>timer', 'command>reply'), [
    instance('label', 'label', 'Death counter', {}, { start: { text: 'Deaths: {{variableValue}}' } }),
    instance('timer', 'timer', 'Since last death', { text: 'Since last death: {time}', size: 36 }),
  ]),

  template('!clip for VIPs', 'VIPs and mods clip the moment with !clip, marked in the VOD; the link goes to chat.', [
    node('command', 'chat-command', 0, 0, { command: '!clip', from: 'vip' }),
    node('cooldown', 'cooldown', 1, 0, { seconds: 60 }),
    node('clip', 'twitch-clip', 2, 0),
    node('marker', 'twitch-marker', 2, 1, { description: '!clip by {{user}}' }),
    node('wait', 'delay', 3, 0, { seconds: 5 }),
    node('link', 'twitch-chat', 4, 0, { message: 'Clip by {{user}}: {{clipUrl}}' }),
    node('blocked', 'twitch-chat', 2, 2, { message: '!clip is on cooldown, try again in {{cooldownLeft}}s', replyTo: '{{messageId}}' }),
  ], links('command>cooldown', 'cooldown:pass>clip', 'cooldown:pass>marker', 'clip>wait', 'wait>link', 'cooldown:blocked>blocked')),

  template('Raid welcome', 'A raid of 3 viewers or more gets a shoutout, an announcement and an alert.', [
    node('raid', 'raid', 0, 0, { minViewers: 3 }),
    node('info', 'twitch-user', 1, 0),
    node('shoutout', 'twitch-shoutout', 2, -1, { channel: '{{profileLogin}}' }),
    node('announce', 'twitch-announce', 2, 0, { message: 'Welcome {{user}} and their {{raidViewers}} raiders! They were playing {{profileGame}}: twitch.tv/{{profileLogin}}', color: 'green' }),
    widget('alert', 2, 1),
  ], links('raid>info', 'info>shoutout', 'info>announce', 'info>alert'), [
    instance('alert', 'alerts', 'Raid alert', { layout: 'trophy', duration: 8 }, { start: { text: '{{user}} is raiding with {{raidViewers}} viewers!' } }),
  ]),

  template('Gift sub bomb', 'Thanks the gifter in chat and welcomes each recipient on screen, one after another.', [
    node('gift', 'gift-subs', 0, 0),
    node('thanks', 'twitch-chat', 1, 0, { message: "Thank you {{user}} for gifting {{ giftCount === 1 ? 'a sub' : giftCount + ' subs' }}!" }),
    node('each', 'fan-out', 1, 1, { list: '{{recipients}}' }),
    widget('alert', 2, 1),
  ], links('gift>thanks', 'gift>each', 'each>alert'), [
    instance('alert', 'alerts', 'Gift welcome', { layout: 'ticket', duration: 4 }, { start: { text: 'Welcome {{item}}, gifted by {{user}}!' } }),
  ]),

  template('Starting soon', 'A Control Pad button shows the "Starting soon" scene with a 5-minute countdown, then switches to "Main".', [
    node('pad', 'deck', 0, 0, { buttons: [{ id: 'soon', icon: 'hourglass', name: 'Starting soon', color: '#9147ff' }] }),
    node('scene', 'obs-scene', 1, -1, { scene: 'Starting soon' }),
    // The countdown is reset first, then started a second later (at once, the start could come first).
    node('wait', 'delay', 1, 0.5),
    widget('countdown', 2, 0.5, ['reset']),
    node('main', 'obs-scene', 3, 0.5, { scene: 'Main' }),
  ], links('pad:soon>scene', 'pad:soon>countdown:reset', 'pad:soon>wait', 'wait>countdown', 'countdown>main'), [
    instance('countdown', 'countdown', 'Starting soon', { text: 'Starting in {time}', ended: 'Starting now!' }, { start: { mode: 'for', duration: '5:00' } }),
  ]),

  template('BRB + ad break', 'A Control Pad button warns chat, then runs a 90 s ad on the "BRB" scene, counting down, and switches back.', [
    node('pad', 'deck', 0, 0, { buttons: [{ id: 'brb', icon: 'coffee', name: 'BRB', color: '#ff7a00' }] }),
    node('warn', 'twitch-announce', 1, 0, { message: 'Quick break! Ads start in 30 seconds, back in about 2 minutes.', color: 'orange' }),
    node('wait', 'delay', 2, 0, { seconds: 30 }),
    node('ad', 'twitch-ad', 3, -1, { length: 90 }),
    node('scene', 'obs-scene', 3, 0, { scene: 'BRB', back: 90 }),
    widget('countdown', 3, 1, ['reset']), // reset by the button: the countdown from the last break, back to 1:30
  ], links('pad:brb>warn', 'pad:brb>countdown:reset', 'warn>wait', 'wait>ad', 'wait>scene', 'wait>countdown'), [
    instance('countdown', 'countdown', 'Back in', { text: 'Back in {time}', ended: 'Back now!' }, { start: { mode: 'for', duration: '1:30' } }),
  ]),

  template('Going live', 'Going live sets the lights and posts the stream to a Discord webhook; ending turns the lights off.', [
    node('stream', 'stream-status', 0, 0),
    node('status', 'switch', 1, 0, { value: '{{streamStatus}}', cases: ['online', 'offline'] }),
    node('lights', 'hue', 2, -1, { mode: 'set', color: '#9147ff', brightness: 80 }),
    node('wait', 'delay', 2, 0, { seconds: 20 }), // Twitch takes a moment to list the stream
    node('info', 'twitch-channel-info', 3, 0),
    node('discord', 'http-request', 4, 0, {
      url: 'https://discord.com/api/webhooks/your-webhook',
      body: "{{ JSON.stringify({ content: 'Live now: ' + streamTitle + ' (' + streamGame + ') https://twitch.tv/' + $vars.channel }) }}",
    }),
    node('off', 'hue', 2, 1, { mode: 'off' }),
  ], links('stream>status', 'status:1>lights', 'status:1>wait', 'wait>info', 'info>discord', 'status:2>off')),

  // Engagement and games
  template('Chat poll', 'Mods start the poll with !poll; chat votes with !vote 1 or !vote yes; the result is announced.', [
    node('poll', 'chat-command', 0, 0, { command: '!poll', from: 'mod' }),
    node('vote', 'chat-command', 0, 1, { command: '!vote' }),
    widget('voting', 2, 0, ['vote']),
    node('result', 'twitch-announce', 3, 0, { message: 'Poll closed: {{winner}} wins ({{voteCount}} votes)' }),
  ], links('poll>voting', 'vote>voting:vote', 'voting>result'), [
    instance('voting', 'voting', 'Chat poll', { title: 'Who wins?', options: ['Yes', 'No'], duration: 60 }, { vote: { option: '{{args.0}}', user: '{{user}}' } }),
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
    node('chat', 'chat-message', 0, -1), // above the pad: "push", its port, is the widget node's first
    widget('plays', 1, 0, ['start', 'stop']),
    node('keys', 'key-press', 2, 0, { keys: '{{playsKeys}}' }),
  ], links('pad:start>plays:start', 'pad:stop>plays:stop', 'chat>plays', 'plays>keys'), [
    instance('plays', 'twitch-plays', 'Twitch Plays', {}, { push: { text: '{{message}}', user: '{{user}}' } }),
  ]),

  // Original
  template('Subathon', 'Control Pad buttons start and pause a 4-hour countdown; each sub adds 5 minutes, each 100 bits 1 minute.', [
    node('pad', 'deck', 0, 0, { buttons: [
      { id: 'start', icon: 'player-play', name: 'Start', color: '#2f9e44' },
      { id: 'pause', icon: 'player-pause', name: 'Pause', color: '#ffb400' },
    ] }),
    node('sub', 'subscription', 0, 1),
    node('cheer', 'cheer', 0, 2, { minBits: 100 }),
    // Each sets the time its trigger adds, for the countdown's add (its input: {{time}}).
    node('subTime', 'edit-data', 1, 1, { values: [{ name: 'time', value: '+5m' }] }),
    node('bitsTime', 'edit-data', 1, 2, { values: [{ name: 'time', value: '+{{ Math.floor(bits / 100) }}m' }] }),
    widget('countdown', 2, 1, ['add', 'pause']),
    // Pause lets the workflow waiting on the countdown go on too: only its end is announced.
    node('over', 'filter', 3, 1, { value: '{{countdownLeft}}', operator: 'equals', compare: '0:00' }),
    node('end', 'twitch-announce', 4, 1, { message: 'The subathon is over! Thank you all!', color: 'purple' }),
  ], links('pad:start>countdown', 'pad:pause>countdown:pause', 'sub>subTime', 'cheer>bitsTime', 'subTime>countdown:add', 'bitsTime>countdown:add',
    'countdown>over', 'over>end'), [
    instance('countdown', 'countdown', 'Subathon', { text: 'Subathon ends in {time}', ended: 'Subathon over!' }, {
      start: { mode: 'for', duration: '4h' },
      add: { time: '{{time}}' },
    }),
  ]),

  template('Hype Train mood', 'A Hype Train pulses the lights and shows its level; its end celebrates in gold and in chat.', [
    node('train', 'hype-train', 0, 0),
    node('phase', 'switch', 1, 0, { value: '{{hypePhase}}', cases: ['begin', 'progress', 'end'] }),
    node('pulse', 'hue', 2, -1, { mode: 'routine', steps: [...pulse('#9147ff', 600), ...pulse('#ff4f8b', 600)], loop: 'times', times: 10 }),
    widget('label', 3, 0, ['stop']),
    node('gold', 'hue', 2, 2, { mode: 'routine', steps: pulse('#ffb400', 400), loop: 'times', times: 5 }),
    node('thanks', 'twitch-announce', 2, 3, { message: 'The Hype Train reached level {{hypeLevel}}! Top conductor: {{hypeTopUser}}. Thank you all!', color: 'purple' }),
  ], links('train>phase', 'phase:1>pulse', 'phase:1>label', 'phase:2>label', 'phase:3>label:stop', 'phase:3>gold', 'phase:3>thanks'), [
    instance('label', 'label', 'Hype Train', {}, { start: { text: 'Hype Train level {{hypeLevel}}: {{ Math.round(hypeProgress / hypeGoal * 100) || 0 }}%' } }),
  ]),

  template('Chat guard', 'Deletes bad words, and links from viewers who have followed for less than a week (with a 60 s timeout).', [
    node('chat', 'chat-message', 0, 0),
    node('viewer', 'filter', 1, 0, { value: '{{ mod || vip || broadcaster }}', operator: 'equals', compare: 'false' }),
    node('words', 'word-filter', 2, 0),
    node('bad', 'if-else', 3, 0, { value: '{{hasBadWords}}', operator: 'equals', compare: 'true' }),
    node('delete', 'twitch-delete-message', 7, 0),
    node('warnWords', 'twitch-chat', 4, -1, { message: '@{{user}} please keep it clean.' }),
    node('link', 'filter', 4, 1, { value: '{{message}}', operator: 'matches', compare: 'https?://|www\\.|\\b[a-z0-9-]+\\.(com|net|org|gg|tv|io|ly)\\b' }),
    node('info', 'twitch-user', 5, 1),
    node('new', 'filter', 6, 1, { value: '{{ profileFollowDays >= 7 }}', operator: 'equals', compare: 'false' }),
    node('timeout', 'twitch-ban', 7, 1, { reason: 'Link before following for a week' }),
    node('warnLink', 'twitch-chat', 7, 2, { message: '@{{user}} links are for followers of a week or more. Ask a mod to share one.' }),
  ], links('chat>viewer', 'viewer>words', 'words>bad', 'bad:true>delete', 'bad:true>warnWords', 'bad:false>link', 'link>info',
    'info>new', 'new>delete', 'new>timeout', 'new>warnLink')),
]
