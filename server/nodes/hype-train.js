// Trigger: fires when a Hype Train starts, moves on or ends (Twitch EventSub, Streamer mode).
// data = { phase: begin | progress | end, level, total, progress, goal, top (top contributor) }.
export default {
  type: 'hype-train',
  label: 'Hype Train',
  icon: 'flame',
  category: 'trigger',
  group: 'Twitch',
  needs: ['twitch'],
  description: 'Fires when a Hype Train starts, moves on or ends.',
  adds: ['phase', 'level', 'total', 'progress', 'goal', 'top'],
  fields: { phase: { options: ['any', 'begin', 'progress', 'end'] } },
  event: ['channel.hype_train.begin', 'channel.hype_train.progress', 'channel.hype_train.end'],
  config: { phase: 'any' },
  manual: {
    config: (config) => ({ phase: config.phase === 'any' ? 'begin' : config.phase, level: 1, top: '{{ $vars.channel }}' }),
    fields: { phase: { options: ['begin', 'progress', 'end'] } },
    event: ({ phase, level, top }) => ({
      event: `channel.hype_train.${phase}`,
      data: { level: Number(level), total: 1500, progress: 500, goal: 1000, top_contributions: [{ user_name: top, total: 1000 }] },
    }),
  },
  run({ config, data, event }) {
    const phase = event.split('.')[2]
    if (config.phase !== 'any' && config.phase !== phase) return null
    const top = [...(data.top_contributions ?? [])].sort((a, b) => b.total - a.total)[0]
    return { phase, level: data.level, total: data.total, progress: data.progress ?? '', goal: data.goal ?? '',
      top: top?.user_name ?? '' }
  },
}
