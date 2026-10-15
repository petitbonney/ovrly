// Logic: waits before passing data on.
export default {
  type: 'delay',
  label: 'Delay',
  category: 'logic',
  description: 'Waits before passing data on.',
  fields: { ms: { label: 'Delay', unit: 'ms' } },
  config: { ms: 1000 },
  async run({ config, data, signal }) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, config.ms)
      signal.addEventListener('abort', () => resolve(clearTimeout(timer)), { once: true }) // workflow cancelled
    })
    return data
  },
}
