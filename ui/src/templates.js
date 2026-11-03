// Starter templates: import bundles (see share.js) with a name, a description and a category (a heading in the New
// workflow dialog: an even count in each fills its two columns). Each is one workflow, imported
// switched off: names in quotes (scenes, sources, rewards), links in chat messages and Hue lights are to set first.
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
const category = (title, ...list) => list.map((t) => ({ ...t, category: title }))

// A template with its workflows laid out as the editor's Arrange does (layout.js), so it opens tidy. defs: node types.
export const arranged = (t, defs) => ({ ...t, workflows: t.workflows.map((w) => {
  const at = layout(w.nodes, w.edges, defs)
  return { ...w, nodes: w.nodes.map((n) => ({ ...n, position: at[n.id] })) }
}) })

// Hue routine steps: a color pulsing between full and low brightness.
const pulse = (color, ms) => [{ action: 'set', color, brightness: 100, duration: ms }, { action: 'set', color, brightness: 20, duration: ms }]


export default [
  ...category('Essential',
    template('Event alerts', 'Follows, subs, cheers and raids, each with its own text and a sound, shown one after another.', [
      node('follow', 'follow', 0, 0),
      node('sub', 'subscription', 0, 1, { kinds: ['sub', 'resub'] }),
      node('cheer', 'cheer', 0, 2),
      node('raid', 'raid', 0, 3),
      node('followText', 'edit-data', 1, 0, { values: [{ name: 'text', value: '{{user}} just followed!' }] }),
      node('subText', 'edit-data', 1, 1, { values: [{ name: 'text', value: "{{ subKind === 'resub' ? user + ' resubscribed for ' + subMonths + ' months!' : user + ' just subscribed!' }}" }] }),
      node('cheerText', 'edit-data', 1, 2, { values: [{ name: 'text', value: '{{user}} cheered {{bits}} bits!' }] }),
      node('raidText', 'edit-data', 1, 3, { values: [{ name: 'text', value: '{{user}} is raiding with {{raidViewers}} viewers!' }] }),
      node('queue', 'queue', 2, 1.5),
      widget('alerts', 3, 1),
      widget('sound', 3, 2),
    ], links('follow>followText', 'sub>subText', 'cheer>cheerText', 'raid>raidText',
      'followText>queue', 'subText>queue', 'cheerText>queue', 'raidText>queue', 'queue>alerts', 'queue>sound'), [
      instance('alerts', 'alerts', 'Event alerts', { layout: 'flap', duration: 6 }, { start: { text: '{{text}}' } }),
      instance('sound', 'sound', 'Alert sound', { duration: 6 }), // its sound: a file, picked on the node
    ]),

    template('Chat commands', 'Chat gets your links with !socials and !discord, once every 30 s; !lurk says goodbye, once per viewer.', [
      node('socials', 'chat-command', 0, 0, { command: '!socials' }),
      node('discord', 'chat-command', 0, 1, { command: '!discord' }),
      node('lurk', 'chat-command', 0, 2, { command: '!lurk' }),
      node('socialsWait', 'cooldown', 1, 0),
      node('discordWait', 'cooldown', 1, 1),
      node('lurkWait', 'cooldown', 1, 2, { seconds: 0, byKey: true, keySeconds: 600 }),
      node('socialsReply', 'twitch-chat', 2, 0, { message: 'Find me on YouTube: youtube.com/@you, and on Bluesky: @you.bsky.social' }),
      node('discordReply', 'twitch-chat', 2, 1, { message: 'Join the community Discord: discord.gg/your-invite' }),
      node('lurkReply', 'twitch-chat', 2, 2, { message: 'Enjoy the lurk, {{user}}! Thanks for keeping the stream on.', replyTo: '{{messageId}}' }),
    ], links('socials>socialsWait', 'discord>discordWait', 'lurk>lurkWait',
      'socialsWait:pass>socialsReply', 'discordWait:pass>discordReply', 'lurkWait:pass>lurkReply')),

    template('Chat reminders', 'Every 15 minutes while live, announces the next of three messages, in turn.', [
      node('every', 'schedule', 0, 0, { minutes: 15, when: 'live' }),
      node('next', 'edit-variable', 1, 0, { name: 'reminder', operation: 'set', value: '{{ (Number($vars.reminder) || 0) % 3 + 1 }}' }),
      node('message', 'map-value', 2, 0, { key: 'value', map: [
        { from: '1', to: 'Enjoying the stream? Hit Follow to know when I go live!' },
        { from: '2', to: 'Join the community Discord: discord.gg/your-invite' },
        { from: '3', to: 'Try the chat commands: !socials, !discord, !lurk' },
      ] }),
      node('announce', 'twitch-announce', 3, 0, { message: '{{variableValue}}', color: 'purple' }),
    ], links('every>next', 'next>message', 'message>announce')),

    template('Channel points media', 'Redeeming "Airhorn" plays an airhorn; redeeming "Show a GIF" shows a GIPHY GIF of what the viewer typed.', [
      node('airhorn', 'redeem', 0, 0, { reward: 'Airhorn' }),
      node('gif', 'redeem', 0, 1, { reward: 'Show a GIF' }),
      node('sound', 'myinstants', 1, 0, { pick: 'random', search: 'airhorn' }),
      node('search', 'giphy', 1, 1, { pick: 'random', search: '{{rewardInput}}' }),
      widget('horn', 2, 0),
      widget('image', 2, 1),
    ], links('airhorn>sound', 'gif>search', 'sound>horn', 'search>image'), [
      instance('horn', 'sound', 'Airhorn', { duration: 5, volume: 60 }, { start: { sound: '{{sound}}' } }),
      instance('image', 'image', 'Viewer GIF', { duration: 6 }, { start: { image: '{{giphyUrl}}' } }),
    ]),
  ),

  ...category('Utility',
    template('Stream segments', 'Control Pad buttons: Starting soon counts down to "Main", BRB runs a 90 s ad break, Ending thanks chat.', [
      node('pad', 'deck', 0, 0, { buttons: [
        { id: 'soon', icon: 'alarm', name: 'Starting soon', color: '#9147ff' },
        { id: 'brb', icon: 'coffee', name: 'BRB', color: '#ff7a00' },
        { id: 'end', icon: 'moon', name: 'Ending', color: '#e03131' },
      ] }),
      node('soonScene', 'obs-scene', 1, -1, { scene: 'Starting soon' }),
      // A countdown is reset first, then started a second later (at once, the start could come first).
      node('soonWait', 'delay', 1, 0),
      widget('soon', 2, 0, ['reset']),
      node('main', 'obs-scene', 3, 0, { scene: 'Main' }),
      node('warn', 'twitch-announce', 1, 1, { message: 'Quick break! Ads start in 30 seconds, back in about 2 minutes.', color: 'orange' }),
      node('brbWait', 'delay', 2, 1, { seconds: 30 }),
      node('ad', 'twitch-ad', 3, 1, { length: 90 }),
      node('brbScene', 'obs-scene', 3, 2, { scene: 'BRB', back: 90 }),
      widget('brb', 3, 3, ['reset']),
      node('endScene', 'obs-scene', 1, 4, { scene: 'Ending' }),
      node('thanks', 'twitch-announce', 1, 5, { message: 'Thanks for watching! See you next stream.', color: 'purple' }),
    ], links('pad:soon>soonScene', 'pad:soon>soon:reset', 'pad:soon>soonWait', 'soonWait>soon', 'soon>main',
      'pad:brb>warn', 'pad:brb>brb:reset', 'warn>brbWait', 'brbWait>ad', 'brbWait>brbScene', 'brbWait>brb',
      'pad:end>endScene', 'pad:end>thanks'), [
      instance('soon', 'countdown', 'Starting soon', { text: 'Starting in {time}', ended: 'Starting now!' }, { start: { mode: 'for', duration: '5:00' } }),
      instance('brb', 'countdown', 'Back in', { text: 'Back in {time}', ended: 'Back now!' }, { start: { mode: 'for', duration: '1:30' } }),
    ]),

    template('Death counter', 'Control Pad buttons count deaths on screen, with the time since the last; chat asks with !deaths.', [
      node('pad', 'deck', 0, 0, { buttons: [
        { id: 'add', icon: 'skull', name: 'Death +1', color: '#e03131' },
        { id: 'undo', icon: 'thumb-down', name: 'Undo', color: '#ffb400' },
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

    template('Raid & shoutout', 'A raid of 3 viewers or more gets a shoutout, an announcement and an alert; mods shout out anyone with !so @name.', [
      node('raid', 'raid', 0, 0, { minViewers: 3 }),
      node('info', 'twitch-user', 1, 0),
      node('shoutout', 'twitch-shoutout', 2, -1, { channel: '{{profileLogin}}' }),
      node('announce', 'twitch-announce', 2, 0, { message: 'Welcome {{user}} and their {{raidViewers}} raiders! They were playing {{profileGame}}: twitch.tv/{{profileLogin}}', color: 'green' }),
      widget('alert', 2, 1),
      node('so', 'chat-command', 0, 2, { command: '!so', from: 'mod' }),
      node('named', 'filter', 1, 2, { value: '{{args.0}}', operator: 'matches', compare: '\\w' }),
      node('soShoutout', 'twitch-shoutout', 2, 2, { channel: "{{ args[0].replace('@', '') }}" }),
      node('soChat', 'twitch-chat', 2, 3, { message: "Go follow {{ args[0].replace('@', '') }}: twitch.tv/{{ args[0].replace('@', '') }}" }),
    ], links('raid>info', 'info>shoutout', 'info>announce', 'info>alert', 'so>named', 'named>soShoutout', 'named>soChat'), [
      instance('alert', 'alerts', 'Raid alert', { layout: 'trophy', duration: 8 }, { start: { text: '{{user}} is raiding with {{raidViewers}} viewers!' } }),
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
  ),

  ...category('Advanced',
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

    template('Challenge wheel', 'Redeeming "Spin the wheel" spins a wheel of challenges, some run for you: the cam hides, the lights go off, an airhorn.', [
      node('redeem', 'redeem', 0, 0, { reward: 'Spin the wheel' }),
      node('queue', 'queue', 1, 0),
      widget('wheel', 2, 0),
      node('result', 'twitch-chat', 3, -1, { message: '{{user}} spun the wheel: {{winner}}!' }),
      node('challenge', 'switch', 3, 0, { value: '{{winner}}', cases: ['Hide the cam', 'Lights off', 'Airhorn'] }),
      node('hide', 'obs-source', 4, -1, { scene: 'Main', source: 'Camera', visible: 'hide' }),
      node('hidden', 'delay', 5, -1, { seconds: 60 }),
      node('show', 'obs-source', 6, -1, { scene: 'Main', source: 'Camera', visible: 'show' }),
      node('dark', 'hue', 4, 0, { mode: 'routine', steps: [{ action: 'off', duration: 60000 }], loop: 'once' }), // then restored
      node('sound', 'myinstants', 4, 1, { pick: 'random', search: 'airhorn' }),
      widget('horn', 5, 1),
    ], links('redeem>queue', 'queue>wheel', 'wheel>result', 'wheel>challenge', 'challenge:1>hide', 'hide>hidden', 'hidden>show',
      'challenge:2>dark', 'challenge:3>sound', 'sound>horn'), [
      instance('wheel', 'lottery', 'Challenge wheel', { duration: 6, options: [
        { label: 'Hide the cam', weight: 1 },
        { label: 'Lights off', weight: 1 },
        { label: 'Airhorn', weight: 1 },
        { label: 'Hydrate!', weight: 1 },
        { label: '10 push-ups', weight: 1 },
        { label: 'Nothing, lucky you', weight: 2 },
      ] }),
      instance('horn', 'sound', 'Airhorn', { duration: 5, volume: 60 }, { start: { sound: '{{sound}}' } }),
    ]),

    template('Light show', 'Follows flash the lights and subs pulse them; a Hype Train pulses them and shows its level, its end celebrates in gold.', [
      node('follow', 'follow', 0, -2),
      node('sub', 'subscription', 0, -1),
      node('flash', 'hue', 1, -2, { mode: 'routine', steps: pulse('#3d8bff', 300), loop: 'times', times: 2 }),
      node('subPulse', 'hue', 1, -1, { mode: 'routine', steps: pulse('#9147ff', 500), loop: 'times', times: 4 }),
      node('train', 'hype-train', 0, 0),
      node('phase', 'switch', 1, 0, { value: '{{hypePhase}}', cases: ['begin', 'progress', 'end'] }),
      node('pulse', 'hue', 2, -1, { mode: 'routine', steps: [...pulse('#9147ff', 600), ...pulse('#ff4f8b', 600)], loop: 'times', times: 10 }),
      widget('label', 3, 0, ['stop']),
      node('gold', 'hue', 2, 2, { mode: 'routine', steps: pulse('#ffb400', 400), loop: 'times', times: 5 }),
      node('thanks', 'twitch-announce', 2, 3, { message: 'The Hype Train reached level {{hypeLevel}}! Top conductor: {{hypeTopUser}}. Thank you all!', color: 'purple' }),
    ], links('follow>flash', 'sub>subPulse', 'train>phase', 'phase:1>pulse', 'phase:1>label', 'phase:2>label', 'phase:3>label:stop', 'phase:3>gold', 'phase:3>thanks'), [
      instance('label', 'label', 'Hype Train', {}, { start: { text: 'Hype Train level {{hypeLevel}}: {{ Math.round(hypeProgress / hypeGoal * 100) || 0 }}%' } }),
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

    template('Twitch Plays', 'Chat plays the game: up, down, a, b… become key presses; every 5 minutes, anarchy and democracy take turns.', [
      node('chat', 'chat-message', 0, -1), // first: "push", its port, is the widget node's first
      node('pad', 'deck', 0, 0, { buttons: [
        { id: 'start', icon: 'player-play', name: 'Start', color: '#2f9e44' },
        { id: 'stop', icon: 'player-stop', name: 'Stop', color: '#e03131' },
      ] }),
      // The mode is kept in a variable too, for the chat to be told which (the widget's Mode passes nothing on).
      node('every', 'schedule', 0, 1, { minutes: 5 }),
      node('mode', 'edit-variable', 1, 1, { name: 'playsMode', operation: 'set', value: "{{ $vars.playsMode === 'democracy' ? 'anarchy' : 'democracy' }}" }),
      widget('plays', 2, 0, ['start', 'stop', 'mode']),
      node('keys', 'key-press', 3, 0, { keys: '{{playsKeys}}' }),
      node('tell', 'twitch-chat', 2, 2, { message: "Twitch Plays: {{ variableValue === 'democracy' ? 'democracy, the most voted command every 5 s' : 'anarchy, every command counts' }}, for the next 5 minutes!" }),
    ], links('chat>plays', 'pad:start>plays:start', 'pad:stop>plays:stop', 'every>mode', 'mode>plays:mode', 'mode>tell', 'plays>keys'), [
      instance('plays', 'twitch-plays', 'Twitch Plays', {}, {
        push: { text: '{{message}}', user: '{{user}}' },
        mode: { mode: '{{variableValue}}' },
      }),
    ]),

    template('Chat decides', 'Mods start a poll with !poll; chat votes with !vote 1 or !vote gaming; the winning scene goes on.', [
      node('poll', 'chat-command', 0, 0, { command: '!poll', from: 'mod' }),
      node('vote', 'chat-command', 0, 1, { command: '!vote' }),
      widget('voting', 1, 0, ['vote']),
      node('result', 'twitch-announce', 2, -1, { message: 'Chat decided: {{winner}} ({{voteCount}} votes)!' }),
      node('scene', 'switch', 2, 0, { value: '{{winner}}', cases: ['Chatting', 'Gaming'] }),
      node('chatting', 'obs-scene', 3, -0.5, { scene: 'Chatting' }),
      node('gaming', 'obs-scene', 3, 0.5, { scene: 'Gaming' }),
    ], links('poll>voting', 'vote>voting:vote', 'voting>result', 'voting>scene', 'scene:1>chatting', 'scene:2>gaming'), [
      instance('voting', 'voting', 'Chat decides', { title: 'What next?', options: ['Chatting', 'Gaming'], duration: 60 }, { vote: { option: '{{args.0}}', user: '{{user}}' } }),
    ]),
  ),
]
