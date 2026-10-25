// Logic: waits until every incoming link has delivered data (from any firing, e.g. two triggers), then continues once
// with it all merged. The engine does the waiting (`join`); its settings can force it on or cancel the wait.
export default {
  type: 'wait-all',
  label: 'Wait For All',
  category: 'logic',
  group: 'Flow',
  description: 'Continues once every incoming link has delivered, with all their data merged.',
  join: true,
  config: {},
  run: ({ data }) => data,
}
