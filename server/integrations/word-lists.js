// Word lists: the LDNOOBW lists of bad words (CC BY 4.0), one per language, each downloaded the first time it's used
// (a Word Filter node saved or run with it) into data/word-lists/.
import fs from 'node:fs'
import path from 'node:path'

// The lists at a fixed commit, so they can't change behind a filter's back. The file names are the language codes.
const BASE = 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/5faf2ba42d7b1c0977169ec3611df25a3c08eb13'
const names = new Intl.DisplayNames(['en'], { type: 'language' })
export const LANGS = Object.fromEntries(['ar', 'cs', 'da', 'de', 'en', 'eo', 'es', 'fa', 'fi', 'fil', 'fr', 'fr-CA-u-sd-caqc', 'hi',
  'hu', 'it', 'ja', 'kab', 'ko', 'nl', 'no', 'pl', 'pt', 'ru', 'sv', 'th', 'tlh', 'tr', 'zh']
  .map((l) => [l, l === 'fr-CA-u-sd-caqc' ? 'Quebec French' : names.of(l)]))
// Written without spaces between words: their words are found anywhere in a text, not only as whole words.
export const UNSPACED = ['ja', 'th', 'zh']
export const DEFAULT = ['en', 'fr']

const dir = path.resolve('data/word-lists')
const loaded = {} // lang -> Promise of its words

// The words of a list, from disk or downloaded (to a .part file first, so a cut download is never taken for a whole one).
export function load(lang) {
  if (!LANGS[lang]) return Promise.reject(new Error(`Word Filter: unknown list "${lang}"`))
  loaded[lang] ??= (async () => {
    const file = path.join(dir, `${lang}.txt`)
    if (!fs.existsSync(file)) {
      const res = await fetch(`${BASE}/${lang}`).catch((err) => ({ statusText: err.message }))
      if (!res.ok) throw new Error(`Word Filter: couldn't download the ${LANGS[lang]} list (${res.status ?? res.statusText})`)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(`${file}.part`, await res.text())
      fs.renameSync(`${file}.part`, file)
    }
    return fs.readFileSync(file, 'utf8').split('\n').map((w) => w.trim()).filter(Boolean)
  })().catch((err) => {
    delete loaded[lang] // tried again next time
    throw err
  })
  return loaded[lang]
}

// After a workflow is saved: downloads the lists its Word Filter nodes picked, so they're there before the first run.
export function prefetch(workflow) {
  const langs = workflow.nodes.filter((n) => n.data.type === 'word-filter').flatMap((n) => n.data.config?.lists ?? DEFAULT)
  for (const lang of new Set(langs)) load(lang).catch((err) => console.warn(err.message))
}
