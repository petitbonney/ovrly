// A Code node's JavaScript editor (CodeMirror): highlighting in the theme's colors (app.css), Tab to indent, completion
// of `data.` (the keys from previous nodes) and `$vars.` (the variables), and syntax errors marked as you type.
import { useEffect, useRef, useState } from 'react'
import { Text } from '@mantine/core'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript'
import { syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'
import { classHighlighter } from '@lezer/highlight'
import { get } from './api.js'

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

// Mantine's input look, so the editor follows every theme.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', color: 'var(--mantine-color-text)', background: 'var(--mantine-color-default)',
    border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)' },
  '&.cm-focused': { outline: 'none', borderColor: 'var(--mantine-primary-color-filled)' },
  '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, monospace' },
  '.cm-gutters': { background: 'transparent', color: 'var(--mantine-color-dimmed)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { background: 'var(--mantine-color-default-hover)' },
  '.cm-cursor': { borderLeftColor: 'var(--mantine-color-text)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { background: 'color-mix(in srgb, var(--mantine-primary-color-filled) 35%, transparent)' },
  '.cm-tooltip': { background: 'var(--mantine-color-body)', color: 'var(--mantine-color-text)', border: '1px solid var(--mantine-color-default-border)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { background: 'var(--mantine-primary-color-light)', color: 'var(--mantine-color-text)' },
  '.cm-panels': { background: 'var(--mantine-color-body)', color: 'var(--mantine-color-text)' },
})

// The code as the server runs it, else the error: located at the parser's first error node, else on line 1.
function check(view, onError) {
  try {
    new AsyncFunction('data', '$vars', 'console', view.state.doc.toString())
    onError(null)
    return []
  } catch (err) {
    let at = null
    syntaxTree(view.state).iterate({ enter: (n) => { if (n.type.isError && at === null) at = n.from } })
    const line = view.state.doc.lineAt(at ?? 0)
    onError(`Line ${line.number}: ${err.message}`)
    return [{ from: line.from, to: line.to, severity: 'error', message: err.message }]
  }
}

// keys: { data, vars }, read when completing so they're always the latest.
const completions = (keys) => (ctx) => {
  const word = ctx.matchBefore(/(?:(?:data|\$vars)\.)?[\w$]*/)
  if (!word || (word.from === word.to && !ctx.explicit)) return null
  const [prefix, of] = /^(?:(data|\$vars)\.)?/.exec(word.text)
  const names = of === 'data' ? keys.current.data : of === '$vars' ? keys.current.vars : ['data', '$vars', 'console']
  return { from: word.from + prefix.length, options: names.map((label) => ({ label, type: of ? 'property' : 'variable' })), validFor: /^[\w$]*$/ }
}

// vars: the data keys from previous nodes.
export default function CodeEditor({ value, onChange, vars, autoFocus }) {
  const box = useRef(null)
  const view = useRef(null)
  const latest = useRef(onChange)
  const keys = useRef({ data: [], vars: [] })
  const [error, setError] = useState(null)
  latest.current = onChange
  keys.current.data = vars ?? []
  useEffect(() => {
    get('/api/vars').then((v) => { keys.current.vars = Object.keys(v) }, () => {})
    view.current = new EditorView({
      parent: box.current,
      doc: value,
      extensions: [
        basicSetup, keymap.of([indentWithTab]), javascript(), syntaxHighlighting(classHighlighter), theme, EditorView.lineWrapping,
        javascriptLanguage.data.of({ autocomplete: completions(keys) }),
        linter((v) => check(v, setError), { delay: 300 }), lintGutter(),
        EditorView.updateListener.of((u) => u.docChanged && latest.current(u.state.doc.toString())),
      ],
    })
    if (autoFocus) view.current.focus()
    return () => view.current.destroy()
  }, [])
  // A change from elsewhere (undo in the graph, the other editor of the expanded view).
  useEffect(() => {
    const doc = view.current.state.doc.toString()
    if (value !== doc) view.current.dispatch({ changes: { from: 0, to: doc.length, insert: value } })
  }, [value])
  return (
    <>
      <div ref={box} className="code-editor" />
      {error && <Text size="xs" c="red">{error}</Text>}
    </>
  )
}
