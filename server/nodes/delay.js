// Logic: waits before passing data on.
export default {
  type: 'delay',
  label: 'Delay',
  category: 'logic',
  config: { ms: 1000 },
  async run({ config, data }) {
    await new Promise((resolve) => setTimeout(resolve, config.ms))
    return data
  },
}
