// Action: prints a message and the current data to the server console.
export default {
  type: 'log',
  label: 'Log',
  category: 'action',
  config: { message: 'log' },
  run({ config, data }) {
    console.log(`[${config.message}]`, data)
    return data
  },
}
