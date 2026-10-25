// Logic: lets one firing at a time through. The next ones wait in line until everything after this node has finished
// (e.g. the wheel stopped), then run in arrival order. The engine does the waiting (`queue`); over `max` waiting, new
// firings are dropped.
export default {
  type: 'queue',
  label: 'Queue',
  icon: 'list-numbers',
  category: 'logic',
  group: 'Timing',
  description: 'Runs what follows one firing at a time: the next wait in line, in arrival order.',
  fields: { max: { label: 'Max waiting', presets: [1, 5, 10, 25, 0], off: true, hint: 'Over it, new firings are dropped' } },
  queue: true,
  config: { max: 10 },
  run: ({ data }) => data,
}
