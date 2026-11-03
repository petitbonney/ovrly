// Logic: finds bad words in a data key's text, from word lists of any languages (downloaded when first used,
// integrations/word-lists.js) and words of its own, then masks them or stops. Adds { hasBadWords, badWordCount }
// for a later If / Else. Matching ignores case and accents, and sees through leetspeak (sh1t), repeats (fuuuck) and
// dots between letters (f.u.c.k).
import * as lists from '../integrations/word-lists.js'

// Characters that stand for a letter.
const LEET = { a: 'a@4', e: 'e3', i: 'i1!|', l: 'l1|', o: 'o0', s: 's$5', t: 't7' }
const SYNTAX = /[\^$\\.*+?()[\]{}|/]/g
const EDGE = '\\p{L}\\p{N}' // what a word is made of
const BEFORE = new RegExp(`[${EDGE}]*$`, 'u') // the rest of a word around a match
const AFTER = new RegExp(`^[${EDGE}]*`, 'u')

// A character without its accents and in lower case, the same length so places in the text stay the same.
const foldChar = (c) => {
  const f = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return f.length === c.length ? f : c
}
const fold = (text) => Array.from(text, foldChar).join('')
const split = (tags) => (tags ? tags.split('+').map((w) => fold(w.trim())).filter(Boolean) : [])

// A word as a pattern: each letter any number of times and in its leet forms, dots or the like between letters.
function pattern(word, whole) {
  const letters = Array.from(word, (c) => (c === ' ' ? '\\s+' : `${LEET[c] ? `[${LEET[c].replace(SYNTAX, '\\$&')}]` : c.replace(SYNTAX, '\\$&')}+`))
  const p = letters.join('[._*~-]*')
  return whole ? `(?<![${EDGE}])${p}(?![${EDGE}])` : p
}

// The regex of a config's words, longest first (so "fucker" wins over "fuck"), kept while the config doesn't change.
const regexes = new Map()
async function regexOf(config) {
  const key = JSON.stringify([config.lists, config.extra, config.allowed])
  if (!regexes.has(key)) {
    const allowed = new Set(split(config.allowed))
    const words = new Map() // folded word -> found as a whole word only
    for (const lang of config.lists) for (const w of await lists.load(lang)) words.set(fold(w), !lists.UNSPACED.includes(lang))
    for (const w of split(config.extra)) words.set(w, true)
    for (const w of allowed) words.delete(w)
    const sorted = [...words].sort(([a], [b]) => b.length - a.length)
    if (regexes.size > 20) regexes.clear()
    regexes.set(key, { allowed, regex: sorted.length ? new RegExp(sorted.map(([w, whole]) => pattern(w, whole)).join('|'), 'gu') : null })
  }
  return regexes.get(key)
}

export default {
  type: 'word-filter',
  label: 'Word Filter',
  icon: 'message-off',
  category: 'logic',
  group: 'Data',
  description: 'Masks the bad words in a data key\'s text, or stops when it has some.',
  adds: { hasBadWords: 'true if it found some', badWordCount: 'How many it found' },
  fields: {
    key: { type: 'var', label: 'Key' },
    found: { label: 'If found', options: ['mask', 'stop'] },
    mask: { label: 'Mask with', options: [{ value: 'first', label: 'f***' }, { value: 'stars', label: '****' }, { value: 'text', label: 'Text' }], only: { found: 'mask' } },
    text: { label: 'Mask text', only: { found: 'mask', mask: 'text' } },
    lists: {
      label: 'Word lists',
      options: Object.entries(lists.LANGS).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
      info: 'Lists from the LDNOOBW project (CC BY 4.0), each downloaded the first time it is used. Japanese, Thai and Chinese words are found anywhere in a text, not only as whole words.',
    },
    extra: { type: 'tags', label: 'Extra words' },
    allowed: { type: 'tags', label: 'Allowed words', hint: 'Never masked, even when a list has them' },
  },
  config: { key: 'message', found: 'mask', mask: 'first', text: '[bip]', lists: lists.DEFAULT, extra: '', allowed: '' },
  async run({ config, data }) {
    if (!config.key) throw new Error('Word Filter: no key set')
    const text = data[config.key] == null ? '' : String(data[config.key])
    const { regex, allowed } = await regexOf(config)
    // Matches on the folded text, masks the original: both have the same length.
    const folded = fold(text)
    let out = ''
    let last = 0
    let badWords = 0
    for (const { 0: match, index: at } of regex ? folded.matchAll(regex) : []) {
      const word = folded.slice(0, at).match(BEFORE)[0] + match + folded.slice(at + match.length).match(AFTER)[0]
      if (allowed.has(word)) continue // found inside an allowed word
      badWords++
      const chars = Array.from(text.slice(at, at + match.length))
      const masked = config.mask === 'text' ? config.text : config.mask === 'stars' ? '*'.repeat(chars.length) : chars[0] + '*'.repeat(chars.length - 1)
      out += text.slice(last, at) + masked
      last = at + match.length
    }
    if (badWords && config.found === 'stop') return null
    return { ...data, [config.key]: out + text.slice(last), hasBadWords: badWords > 0, badWordCount: badWords }
  },
}
