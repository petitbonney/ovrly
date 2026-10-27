// Fills "{{ ... }}" placeholders in node config text from the workflow data. Inside is a path (`user`, `json.items.0.name`,
// `$vars.score`, `$node.http-request.status` for the output of an earlier node, by type or id) or a JavaScript
// expression with the data keys as variables (`score * 2`). Anything that fails or points at nothing gives ''.
// Expressions run as code: only import workflows you trust.
import { vars } from './vars.js'

const PATH = /^[\w$]+(\.[\w$-]+)*$/
const compiled = {} // expression -> function

function evaluate(expr, data) {
  const scope = Object.assign(Object.create(data), { $vars: vars })
  if (PATH.test(expr)) return expr.split('.').reduce((o, k) => o?.[k], scope)
  try {
    compiled[expr] ??= new Function('scope', `with (scope) { return (${expr}) }`)
    return compiled[expr](scope)
  } catch {}
}

const text = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export const fill = (t, data) => String(t).replace(/\{\{(.+?)\}\}/gs, (m, expr) => text(evaluate(expr.trim(), data)))

// Like fill, but each value goes through escape(value, before), before being the template's own text up to it
// (placeholders blanked), so data (e.g. a chat message) can't change what the text around it means.
const fillWith = (t, data, escape) => String(t).replace(/\{\{(.+?)\}\}/gs, (m, expr, at, s) =>
  escape(evaluate(expr.trim(), data), s.slice(0, at).replace(/\{\{.+?\}\}/gs, '')))

// For JSON (a request body): inside a string, a value is escaped; outside, it becomes a JSON value (a string quoted,
// unless it reads as a number, true, false or null).
const LITERAL = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)$/
export const fillJson = (t, data) => fillWith(t, data, (v, before) => {
  if (before.replace(/\\./g, '').split('"').length % 2 === 0) return JSON.stringify(text(v)).slice(1, -1)
  return typeof v === 'string' && LITERAL.test(v.trim()) ? v.trim() : JSON.stringify(v ?? null)
})

// For URLs: a value in the path or query is encoded (no "../", "&" or "?" from data); one in the scheme, host or port,
// or at the start (a whole URL, e.g. {{ $vars.api }}), is kept as is.
export const fillUrl = (t, data) => fillWith(t, data, (v, before) =>
  /[/?#]/.test(before.replace(/^[a-z][\w+.-]*:\/\//i, '')) ? encodeURIComponent(text(v)) : text(v))

// Like fill, but a text that is one placeholder keeps the value's type (number, object…).
export function value(t, data) {
  const one = /^\{\{(.+?)\}\}$/s.exec(String(t).trim())
  return one && !one[1].includes('}}') ? evaluate(one[1].trim(), data) ?? '' : fill(t, data)
}

// A list field's value, { from: 'custom' | 'data', key, items }: its items with their text filled, or the value of the data
// key (items, or {{items}}).
export function list(v, data) {
  if (v?.from === 'data') {
    const key = String(v.key ?? '').trim().replace(/^\{\{(.*)\}\}$/s, '$1').trim()
    return key ? value(`{{${key}}}`, data) : ''
  }
  const filled = (x) => (typeof x === 'string' ? fill(x, data) : x)
  return (v?.items ?? []).map((item) => (item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).map(([k, x]) => [k, filled(x)])) : filled(item)))
}
