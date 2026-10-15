// Logic: lets one firing at a time through. The next ones wait in line until everything after this node has finished
// (e.g. the wheel stopped), then run in arrival order. The engine does the waiting (`queue`); over `max` waiting, new
// firings are dropped.
export default {
  type: 'queue',
  label: 'Queue',
  category: 'logic',
  description: 'Runs what follows one firing at a time: the next wait in line, in arrival order.',
  fields: { max: { label: 'Max waiting', hint: '0 for no limit; over it, new firings are dropped' } },
  queue: true,
  config: { max: 10 },
  run: ({ data }) => data,
}
