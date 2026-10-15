// App shell: left lists, center editor (workflow or widget), bottom node config, right node library and chat panels.
import { useEffect, useState } from 'react'
import Workflow from './Workflow.jsx'
import Widget, { NewWidget } from './Widget.jsx'
import { Twitch, ChatTest } from './Chat.jsx'

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

  const addWorkflow = async () => {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New workflow', nodes: [], edges: [] }),
    })
    const { id } = await res.json()
    setSelected({ kind: 'workflows', id })
    setVersion((v) => v + 1)
  }

  // Called by the editors after a save (id) or a delete (null).
  const onItemChange = (id) => {
    if (!id) setSelected(null)
    setVersion((v) => v + 1)
  }
  const onWidgetCreate = (id) => {
    setSelected({ kind: 'widgets', id })
    setVersion((v) => v + 1)
  }

  return (
    <div className="shell">
      <aside className="left">
        <List title="Widgets" kind="widgets" selected={selected} onSelect={setSelected} onAdd={() => setSelected({ kind: 'new-widget' })} version={version} />
        <List title="Workflows" kind="workflows" selected={selected} onSelect={setSelected} onAdd={addWorkflow} version={version} />
      </aside>
      {selected?.kind === 'workflows' ? (
        <Workflow key={selected.id} id={selected.id} defs={defs} onChange={onItemChange} />
      ) : selected?.kind === 'widgets' ? (
        <Widget key={selected.id} id={selected.id} types={types} onChange={onItemChange} />
      ) : selected?.kind === 'new-widget' ? (
        <NewWidget types={types} onCreate={onWidgetCreate} />
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
    </div>
  )
}
