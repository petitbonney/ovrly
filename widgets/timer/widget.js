// Timer: counts up from 0 (a speedrun, a challenge, the time since the last death), shown as a text around {time}, like
// a stopwatch: "start" starts it, from 0 or from where "pause" (Stop) held it; "reset" (Cancel) stops it at 0. It's
// always on screen (OBS hides the source). The workflow goes on at once. Its count is kept in the state, so it goes on
// across a restart. Outputs { elapsed } (as the clock shows it) and { seconds }.
import { state as look, fields, clock } from '../clock.js'

// ms counted: since it started, pauses taken out, or held while paused.
export const elapsed = (state, now = Date.now()) => (state.since ? now - state.since : state.held)

export default {
  type: 'timer',
  label: 'Timer',
  icon: 'stopwatch',
  description: 'Counts up from 0, e.g. for a speedrun or a challenge; pause it, reset it, read it with {{timerElapsed}}.',
  // since: when it would have been 0:00 (ms), pauses taken out, while counting; held: the ms counted, while paused.
  state: { ...look, since: 0, held: 0 },
  fields,
  onStop: 'pause',
  onCancel: 'reset',
  adds: { timerElapsed: 'Time counted, e.g. 1:23', timerSeconds: 'Time counted, in seconds' },
  output: ({ state }) => ({ timerElapsed: clock(elapsed(state), state.format), timerSeconds: Math.floor(elapsed(state) / 1000) }),
  playTime: () => 0, // it counts on its own: the workflow goes on at once
  actions: {
    start: {
      description: 'Starts counting, from 0 or from where "pause" held it; counting already, it does nothing.',
      run: ({ state }) => (state.since ? undefined : { state: { ...state, since: Date.now() - state.held, held: 0 } }),
    },
    pause: {
      description: 'Holds the timer where it is, until "start"; the workflow goes on with {{timerElapsed}}.',
      run: ({ state }) => (state.since ? { state: { ...state, since: 0, held: elapsed(state) } } : undefined),
    },
    reset: {
      description: 'Stops the timer at 0:00; the workflow stops there.',
      run: ({ state }) => ({ state: { ...state, since: 0, held: 0 } }),
    },
  },
}
