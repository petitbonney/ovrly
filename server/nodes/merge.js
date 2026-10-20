// Merge Widgets: puts the widget nodes linked into it on one canvas, served as a single overlay page
// (/m/<workflow>/<node>, one OBS browser source). Its settings place each widget; the placement is relative to the
// canvas, so the page fits any source size. In the flow it only passes data on.
export default {
  type: 'merge',
  label: 'Merge Widgets',
  category: 'widget', // listed in the library's Widget section
  description: 'Shows the widgets linked into it on one canvas, as a single OBS browser source. Drag them into place in its settings.',
  fields: {
    // Widget id -> { x, y, w, h } as fractions of the canvas: x and y from its center to the box's center, w and h its size.
    layout: { hidden: true },
    // Widget ids from the top layer down (set in its settings); widgets not in it go on top, the last linked highest.
    order: { hidden: true },
  },
  config: { layout: {}, order: [] },
  run: ({ data }) => data,
}
