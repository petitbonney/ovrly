// Label: a text that stays on screen, e.g. "Now playing: Celeste" or the last follower, until a new one replaces it
// or "stop" hides it. Before its first Start, it shows the text its Start is set to. Like Alerts, the text is the action's input; the workflow goes on at once.
import { textStyle } from '../lib.js'

export const FADE = 300 // ms: the text fading in, out, or into the next one

export default {
  type: 'label',
  label: 'Label',
  icon: 'typography',
  description: 'Shows a text that stays on screen until it changes, e.g. the last follower or the current goal.',
  state: { ...textStyle.state },
  fields: textStyle.fields,
  // text: the label showing; at: when it was set (ms).
  runtime: { text: '', at: 0 },
  playTime: () => 0, // the text stays: the workflow goes on at once
  stopTime: () => FADE,
  actions: {
    start: {
      description: 'Shows the text, in place of the one showing; it stays until changed or stopped.',
      inputs: { text: { vars: true, default: 'Label', hint: 'Text to show, e.g. Last follower: {{user}}' } },
      run: ({ input: { text } }) => ({ runtime: { text, at: Date.now() } }),
    },
    stop: { description: 'The text fades out; the workflow goes on.' },
    cancel: { description: 'The text disappears at once; the workflow stops there.' },
  },
}
