// A small widget type for the tests: a saved step and total, and a shown count in memory.
export const counter = {
  type: 'counter',
  label: 'Counter',
  state: { step: 1, total: 0 },
  runtime: { shown: 0 },
  fields: { step: {} },
  playTime: (action) => (action === 'hold' ? 300 : 0),
  actions: {
    start: { run: ({ state, runtime }) => ({ runtime: { ...runtime, shown: runtime.shown + state.step } }) },
    add: { inputs: { n: {} }, run: ({ state, input }) => ({ state: { ...state, total: state.total + Number(input.n) } }) },
    hold: { run: () => ({ runtime: { shown: 0 } }) },
    noop: { run: () => {} },
    same: { run: ({ state }) => ({ state }) },
  },
}
