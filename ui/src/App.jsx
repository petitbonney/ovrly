// App shell: left lists, center editor, bottom node config, right node library.
import { useEffect, useState } from 'react'

function List({ title, kind, selected, onSelect }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch(`/api/${kind}`).then((r) => r.json()).then(setItems)
  }, [kind])

  return (
    <section>
      <h2>{title} <button title={`New ${kind}`}>+</button></h2>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className={selected?.id === item.id ? 'active' : ''}
            onClick={() => onSelect({ kind, ...item })}
          >
            {item.name || item.id}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function App() {
  const [selected, setSelected] = useState(null)

  return (
    <div className="shell">
      <aside className="left">
        <List title="Widgets" kind="widgets" selected={selected} onSelect={setSelected} />
        <List title="Workflows" kind="workflows" selected={selected} onSelect={setSelected} />
      </aside>
      <main className="center">
        {selected ? `${selected.kind}: ${selected.name || selected.id}` : 'Select a widget or workflow'}
      </main>
      <section className="bottom">Node config</section>
      <aside className="right">
        <h2>Nodes</h2>
      </aside>
    </div>
  )
}
