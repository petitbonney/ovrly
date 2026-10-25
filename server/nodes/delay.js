// Logic: waits before passing data on.
export default {
  type: 'delay',
  label: 'Delay',
  icon: 'hourglass',
  category: 'logic',
  group: 'Timing',
  description: 'Waits before passing data on.',
  fields: { seconds: { label: 'Delay', unit: 's', presets: [1, 3, 5, 10, 30] } },
  config: { seconds: 1 },
  async run({ config, data, signal }) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, config.seconds * 1000)
      signal.addEventListener('abort', () => resolve(clearTimeout(timer)), { once: true }) // workflow cancelled
    })
    return data
  },
}
