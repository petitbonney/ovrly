// Logic: waits until every incoming link has delivered data (from the same trigger firing), then continues once
// with it all merged. The engine does the waiting (`join`); a branch that stops early means it never continues.
export default {
  type: 'wait-all',
  label: 'Wait for all',
  category: 'logic',
  join: true,
  config: {},
  run: ({ data }) => data,
}
