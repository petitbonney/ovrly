// Roulette: "start" draws a number from 0 to 36 (see ../draw.js) on a European roulette. Outputs { winner }, the number.
import { draw } from '../draw.js'

// European roulette: 0 is green; the reds, the rest black.
export const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

export const playMs = (state) => state.duration * 1000
// What can win: index = winner = the number.
export const choices = () => Array.from({ length: 37 }, (_, n) => ({ label: String(n), weight: 1 }))

export default {
  type: 'roulette',
  label: 'Roulette',
  description: 'Draws a number from 0 to 36 on a roulette.',
  state: { duration: 5 },
  fields: { duration: { unit: 's', presets: [3, 5, 8, 12], hint: 'How long a draw lasts' } },
  ...draw(choices, playMs),
}
