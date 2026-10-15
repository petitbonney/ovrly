// Widget editor: config and live preview (center), test actions (bottom), autosaved. Plus the new-widget type picker.
import { useEffect, useState } from 'react'
import { Fields } from './Workflow.jsx'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function NewWidget({ types, onCreate }) {
  const create = async (type) => {
    const res = await fetch('/api/widgets', json('POST', { name: type.label, type: type.type, config: {} }))
    onCreate((await res.json()).id)
  }
  return (
    <>
      <main className="center">
        <div className="stack">
          <h2>New widget</h2>
          {types.map((t) => <button key={t.type} onClick={() => create(t)}>{t.label}</button>)}
        </div>
      </main>
      <section className="bottom" />
    </>
  )
}

// Fires one widget action by hand, like the widget-update node would.
function Test({ widget, type }) {
  const [action, setAction] = useState(type.actions[0])
  const [value, setValue] = useState('')
  const [user, setUser] = useState('tester')
  const send = (e) => {
    e.preventDefault()
    fetch(`/api/widgets/${widget.id}/action`, json('POST', { action, value, user }))
  }
  return (
    <section className="bottom">
      <h2>Test</h2>
      <form className="row-form" onSubmit={send}>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {type.actions.map((a) => <option key={a}>{a}</option>)}
        </select>
        <input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
        <input placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} />
        <button>Send</button>
      </form>
    </section>
  )
}

function Editor({ widget, type, onChange, onDelete }) {
  const [name, setName] = useState(widget.name)
  const [config, setConfig] = useState(widget.config)

  // Debounced autosave; the server pushes the new config to open overlays.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/widgets/${widget.id}`, json('PUT', { name, type: widget.type, config })).then(onChange)
    }, 500)
    return () => clearTimeout(timer)
  }, [name, config])

  const url = `${location.origin}/w/${widget.id}`
  return (
    <>
      <main className="center widget">
        <div className="toolbar">
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={onDelete}>Delete widget</button>
        </div>
        <div className="widget-body">
          <h2>{type.label}</h2>
          <p>OBS browser source: <a href={url} target="_blank">{url}</a></p>
          <Fields defaults={type.config} values={config} onChange={setConfig} />
          <iframe className="preview" src={url} title="Preview" />
        </div>
      </main>
      <Test widget={widget} type={type} />
    </>
  )
}

export default function Widget({ id, types, onChange }) {
  const [widget, setWidget] = useState(null)
  useEffect(() => {
    fetch(`/api/widgets/${id}`).then((r) => r.json()).then(setWidget)
  }, [id])

  const onDelete = async () => {
    await fetch(`/api/widgets/${id}`, { method: 'DELETE' })
    onChange(null)
  }

  const type = types.find((t) => t.type === widget?.type)
  if (!widget || !type) return null
  return <Editor widget={widget} type={type} onChange={() => onChange(id)} onDelete={onDelete} />
}
