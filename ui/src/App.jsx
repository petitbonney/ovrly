// App shell: left lists, center editor (workflow or widget), bottom node config, right node library and chat panels.
import { useEffect, useState } from 'react'
import Workflow from './Workflow.jsx'
import Widget, { NewWidget } from './Widget.jsx'
import { Twitch, ChatTest } from './Chat.jsx'
import templates from './templates.js'
import { importBundle, importFile } from './share.js'

function List({ title, kind, selected, onSelect, onAdd, version }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch(`/api/${kind}`).then((r) => r.json()).then(setItems)
  }, [kind, version])

  return (
    <section>
      <h2>{title} <button title={`New ${kind}`} onClick={onAdd}>+</button></h2>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className={selected?.id === item.id ? 'active' : ''}
            onClick={() => onSelect({ kind, id: item.id })}
          >
            {item.name || item.id}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Library({ defs }) {
  return ['trigger', 'logic', 'action'].map((category) => (
    <section key={category}>
      <h2>{category}</h2>
      <ul>
        {defs.filter((d) => d.category === category).map((d) => (
          <li key={d.type} draggable onDragStart={(e) => e.dataTransfer.setData('application/ovrly', d.type)}>
            {d.label}
          </li>
        ))}
      </ul>
    </section>
  ))
}

// "New workflow" modal: blank, from a template, or imported from a JSON file. Calls onDone with { kind, id }.
function NewWorkflow({ onDone, onClose }) {
  const blank = { workflows: [{ name: 'New workflow', nodes: [], edges: [] }] }
  return (
    <div className="modal" onClick={onClose}>
      <div className="stack" onClick={(e) => e.stopPropagation()}>
        <h2>New workflow <button onClick={onClose}>×</button></h2>
        <button onClick={() => importBundle(blank).then(onDone)}>Blank</button>
        {templates.map((t) => (
          <button key={t.name} onClick={() => importBundle(t).then(onDone)}>
            <b>{t.name}</b><br /><small>{t.description}</small>
          </button>
        ))}
        <button onClick={() => importFile().then(onDone, (err) => alert(`Import failed: ${err.message}`))}>Import JSON…</button>
      </div>
    </div>
  )
}

export default function App() {
  const [selected, setSelected] = useState(null)
  const [defs, setDefs] = useState([])
  const [types, setTypes] = useState([])
  // Bumped to make the lists refetch after a change.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    fetch('/api/nodes').then((r) => r.json()).then(setDefs)
    fetch('/api/widget-types').then((r) => r.json()).then(setTypes)
  }, [])

  const [modal, setModal] = useState(false)

  // Called by the editors after a save (id) or a delete (null).
  const onItemChange = (id) => {
    if (!id) setSelected(null)
    setVersion((v) => v + 1)
  }
  // Called after creating or importing an item ({ kind, id }); an empty import selects nothing.
  const onCreate = (item) => {
    setModal(false)
    setSelected(item ?? null)
    setVersion((v) => v + 1)
  }

  return (
    <div className="shell">
      <aside className="left">
        <List title="Widgets" kind="widgets" selected={selected} onSelect={setSelected} onAdd={() => setSelected({ kind: 'new-widget' })} version={version} />
        <List title="Workflows" kind="workflows" selected={selected} onSelect={setSelected} onAdd={() => setModal(true)} version={version} />
      </aside>
      {selected?.kind === 'workflows' ? (
        <Workflow key={selected.id} id={selected.id} defs={defs} onChange={onItemChange} />
      ) : selected?.kind === 'widgets' ? (
        <Widget key={selected.id} id={selected.id} types={types} onChange={onItemChange} />
      ) : selected?.kind === 'new-widget' ? (
        <NewWidget types={types} onCreate={onCreate} />
      ) : (
        <>
          <main className="center">Select a widget or workflow</main>
          <section className="bottom">Node config</section>
        </>
      )}
      <aside className="right">
        <Library defs={defs} />
        <Twitch />
        <ChatTest />
      </aside>
      {modal && <NewWorkflow onDone={onCreate} onClose={() => setModal(false)} />}
    </div>
  )
}
