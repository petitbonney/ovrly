// Action: toggles a chat mode, or turns it on or off: emote-only, followers-only, subscribers-only, slow or unique chat.
import { helix, channel } from '../sources/twitch-auth.js'
import { needStreamer } from '../sources/twitch.js'

const modes = [
  { value: 'emote', label: 'Emote-only' },
  { value: 'follower', label: 'Followers-only' },
  { value: 'subscriber', label: 'Subscribers-only' },
  { value: 'slow', label: 'Slow mode' },
  { value: 'unique', label: 'Unique chat' },
]
// Mode -> its setting in Twitch's chat settings.
const keys = { emote: 'emote_mode', follower: 'follower_mode', subscriber: 'subscriber_mode', slow: 'slow_mode', unique: 'unique_chat_mode' }

export default {
  type: 'twitch-chat-mode',
  label: 'Chat Mode',
  category: 'action',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Toggles a chat mode, or turns it on or off: emote-only, followers-only, subscribers-only, slow or unique chat.',
  fields: {
    mode: { options: modes, hint: 'Unique chat: no message repeated' },
    turn: { options: ['toggle', 'on', 'off'] },
    seconds: { label: 'Wait between messages', unit: 's', presets: [3, 10, 30, 60, 120], only: { mode: 'slow', turn: ['toggle', 'on'] }, hint: '3 to 120 s' },
    minutes: { label: 'Following for at least', unit: 'min', only: { mode: 'follower', turn: ['toggle', 'on'] }, hint: '0: any follower' },
  },
  config: { mode: 'emote', turn: 'toggle', seconds: 30, minutes: 0 },
  async run({ config, data }) {
    needStreamer('Chat modes')
    const key = keys[config.mode]
    const on = config.turn === 'toggle' ? !(await helix('GET', 'chat/settings', undefined, channel()))[0][key] : config.turn === 'on'
    await helix('PATCH', 'chat/settings', { [key]: on,
      ...(on && config.mode === 'slow' && { slow_mode_wait_time: config.seconds }),
      ...(on && config.mode === 'follower' && { follower_mode_duration: config.minutes }) }, channel())
    return data
  },
}
