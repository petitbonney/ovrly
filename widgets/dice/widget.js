// Dice Roll: "start" rolls a die (see ../draw.js) with six faces of its own. Outputs { winner }, the face on top.
import { draw } from '../draw.js'

// ms a roll lasts: the throw follows physics (dice.js), so always the same.
export const DICE_MS = 3500
export const playMs = () => DICE_MS
// What can win: index = winner = the face.
export const choices = (state) => state.dice.map((label) => ({ label, weight: 1 }))

export default {
  type: 'dice',
  label: 'Dice Roll',
  icon: 'dice-5',
  description: 'Rolls a die and draws the face on top.',
  state: { dice: ['1', '2', '3', '4', '5', '6'], diceColor: '#9147ff', dotColor: '#ffffff' },
  fields: {
    dice: { label: 'Faces', fixed: true, hint: 'A number from 1 to 6 shows as dots' },
    diceColor: { label: 'Dice color' },
    dotColor: { label: 'Dots color', hint: 'Also the text of faces that are not 1 to 6' },
  },
  ...draw(choices, playMs),
}
