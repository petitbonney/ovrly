// Countdown: counts down to 0 for a duration ("start": For 5m, or {{args}} from chat) or until a time of day (Until
// 20:00), shown as a text around {time}, then its ended text. It's always on screen (OBS hides the source): before it
// starts, it shows the time its Start is set to. "start" starts it only from there (or after "reset") or resumes it
// after "pause"; its run waits until 0, and the workflow goes on then. "add" moves the end (a subathon's +30s per sub),
// and the run waiting follows (retime). "pause" (Stop) holds it, the run waiting goes on; "reset" (Cancel) brings it
// back to before its start, the run waiting stops there. Its end is kept in the state, so the countdown goes on across
// a restart (a run waiting on it doesn't). Outputs { remaining }.
import { state as look, fields, clock, duration, nextTime } from '../clock.js'

const MAX = 2 ** 31 - 1 // ms, about 24 days: the longest a run can wait (setTimeout's limit)
const clamp = (ms) => Math.min(MAX, Math.max(0, ms))

const inputs = {
  mode: { options: [{ value: 'for', label: 'For' }, { value: 'until', label: 'Until' }], default: 'for' },
  duration: { vars: true, default: '5:00', only: { mode: 'for' }, hint: 'e.g. 5m, 1h30m, 1:30 or {{args}}' },
  time: { vars: true, default: '20:00', only: { mode: 'until' }, hint: 'A time of day, e.g. 20:00 or 8pm' },
}
// When a countdown started now with these inputs would end (ms); NaN when they aren't a time (e.g. {{args}} unfilled).
const endFrom = (input, now = Date.now()) => (input.mode === 'until' ? nextTime(input.time, now) : now + duration(input.duration))

// ms left: held while paused, until the end once started (0 when over); not started, what its Start is set to (as saved
// on its node, 0 if that isn't a time yet).
export function remaining(state, now = Date.now()) {
  if (state.left) return state.left
  if (state.end) return Math.max(0, state.end - now)
  const input = { ...Object.fromEntries(Object.entries(inputs).map(([key, f]) => [key, f.default])), ...state.input?.start }
  return Math.max(0, endFrom(input, now) - now) || 0
}
const running = (state) => state.end > Date.now()
const { text, format, ...style } = fields

export default {
  type: 'countdown',
  label: 'Countdown',
  icon: 'hourglass',
  description: 'Counts down to 0 for a duration or until a time, e.g. "Starting in 4:59"; the workflow goes on at 0.',
  // The settings, in their order; then end: when it reaches 0 (ms), once started, and left: the ms left, while paused.
  // Both 0: not started (or reset).
  state: { text: look.text, ended: '', format: look.format, pulse: true, ...look, end: 0, left: 0 },
  fields: {
    text,
    ended: { label: 'Ended text', hint: 'Shown at 0 instead, e.g. Starting now! (empty: 0:00 stays)' },
    format,
    pulse: { hint: 'The last 10 seconds beat' },
    ...style,
  },
  onStop: 'pause',
  onCancel: 'reset',
  adds: { countdownLeft: 'Time left, e.g. 4:59' },
  output: ({ state }) => ({ countdownLeft: clock(remaining(state), state.format, Math.ceil) }),
  // "start" plays until 0, however "add" (which doesn't replace it) moves its end.
  playTime: (action, { state }) => (action === 'start' ? remaining(state) : 0),
  retime: true,
  queues: (action) => action !== 'start',
  actions: {
    start: {
      description: 'Starts counting down, for a duration or until a time of day, or resumes it after "pause"; counting already or over, it does nothing ("reset" first). The workflow goes on once it reaches 0.',
      inputs,
      run({ state, input }) {
        if (state.left) return { state: { ...state, end: Date.now() + state.left, left: 0 } }
        if (state.end) return
        const end = endFrom(input)
        if (Number.isNaN(end)) throw new Error(input.mode === 'until' ? `"${input.time}" isn't a time of day, e.g. 20:00` : `"${input.duration}" isn't a duration, e.g. 5m or 1:30`)
        return { state: { ...state, end: Date.now() + clamp(end - Date.now()) } }
      },
    },
    add: {
      description: 'Adds time to the countdown under way or paused, or takes some off with a minus (all of it ends it); outputs {{countdownLeft}}.',
      inputs: { time: { vars: true, default: '+30s', hint: 'e.g. +30s, -1m or {{args}}' } },
      run({ state, input: { time } }) {
        const ms = (time.startsWith('-') ? -1 : 1) * duration(time.replace(/^[+-]/, ''))
        if (Number.isNaN(ms)) throw new Error(`"${time}" isn't a duration, e.g. +30s or -1m`)
        if (state.left) {
          const left = clamp(state.left + ms)
          return { state: { ...state, left, end: left ? 0 : Date.now() } }
        }
        if (running(state)) return { state: { ...state, end: Date.now() + clamp(state.end - Date.now() + ms) } }
      },
    },
    pause: {
      description: 'Holds the countdown where it is, until "start"; the workflow that started it goes on.',
      run: ({ state }) => (running(state) ? { state: { ...state, end: 0, left: state.end - Date.now() } } : undefined),
    },
    reset: {
      description: 'Brings the countdown back to before its start, showing the time its Start is set to; the workflow that started it stops there.',
      run: ({ state }) => ({ state: { ...state, end: 0, left: 0 } }),
    },
  },
}
