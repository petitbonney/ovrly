// Shared by Countdown and Timer (their widget.js and pages, see clock-page.js): their look, reading the times typed or
// sent from chat, and showing a time as a clock, e.g. 1:05:03.

// The look, as Label's, plus the text around the clock and its format.
export const state = { text: '{time}', format: 'auto', font: 'Inter', color: '#ffffff', size: 72, align: 'center' }
export const fields = {
  text: { hint: '{time} is the clock, e.g. Starting in {time}' },
  format: {
    options: [{ value: 'auto', label: 'Auto' }, { value: 'hh:mm:ss', label: 'hh:mm:ss' }, { value: 'mm:ss', label: 'mm:ss' }],
    info: 'Auto shows hours only when there are some: 1:05:03, then 4:59. mm:ss counts the minutes past 60: 65:03.',
  },
  font: { type: 'font', hint: 'A Google Fonts family' },
  color: {},
  size: { unit: 'px', presets: [36, 48, 72, 96] },
  align: { options: ['left', 'center', 'right'] },
}

const two = (n) => String(n).padStart(2, '0')

// A time as a clock in a format (see fields.format), in whole seconds rounded by round: a countdown rounds up, so it
// shows 0:00 only once over.
export function clock(ms, format = 'auto', round = Math.floor) {
  const s = Math.max(0, round(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60
  if (format === 'mm:ss') return `${two(Math.floor(s / 60))}:${two(s % 60)}`
  if (format === 'hh:mm:ss') return `${two(h)}:${two(m)}:${two(s % 60)}`
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

// A duration in ms: "90" or "90s", "5m", "1h30m", "1h 30m 10s", "1:30" (m:ss), "1:02:03" (h:mm:ss); NaN otherwise.
export function duration(text) {
  const t = String(text).trim().toLowerCase().replace(/\s+/g, '')
  if (/^\d+(\.\d+)?$/.test(t)) return t * 1000
  if (/^\d+(:\d{1,2}){1,2}$/.test(t)) return t.split(':').reduce((sum, n) => sum * 60 + Number(n), 0) * 1000
  const n = '(\\d+(?:\\.\\d+)?)'
  const m = t.match(new RegExp(`^(?:${n}h)?(?:${n}m(?:ins?)?)?(?:${n}s)?$`))
  if (!t || !m) return NaN
  return ((m[1] ?? 0) * 3600 + (m[2] ?? 0) * 60 + (m[3] ?? 0) * 1) * 1000
}

// When a time of day next comes, in ms: "20:00", "20h30", "8:30pm", "9pm" (tomorrow's if today's has passed); NaN
// otherwise.
export function nextTime(text, now = Date.now()) {
  const m = String(text).trim().toLowerCase().match(/^(\d{1,2})(?:[:h](\d{2})?)?\s*(am|pm)?$/)
  if (!m) return NaN
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3] && (h < 1 || h > 12)) return NaN
  if (m[3]) h = (h % 12) + (m[3] === 'pm' ? 12 : 0)
  if (h > 23 || min > 59) return NaN
  const at = new Date(now)
  at.setHours(h, min, 0, 0)
  if (at.getTime() <= now) at.setDate(at.getDate() + 1)
  return at.getTime()
}
