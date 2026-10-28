// Logic: waits until every incoming link has delivered data, then continues once with it all merged. The links meet
// within a firing when its trigger leads to all of them (so firings arriving at once don't mix), else across firings
// (e.g. two triggers). The engine does the waiting (`join`); its settings can force it on or cancel the wait.
export default {
  type: 'wait-all',
  label: 'Wait For All',
  icon: 'arrows-join-2',
  category: 'logic',
  group: 'Flow',
  description: 'Continues once every incoming link has delivered, with all their data merged.',
  join: true,
  config: {},
  run: ({ data }) => data,
}
