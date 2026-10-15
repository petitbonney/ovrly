// Widget editor: config, test actions and live preview (center), autosaved. Plus the new-widget type picker.
import { useEffect, useState } from 'react'
import { Anchor, AppShell, Button, Group, NativeSelect, Stack, Text, TextInput } from '@mantine/core'
import { Fields } from './Workflow.jsx'
import Heading from './Heading.jsx'
import { exportItem, download, importFile } from './share.js'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function NewWidget({ types, onCreate }) {
  const create = async (type) => {
    const res = await fetch('/api/widgets', json('POST', { name: type.label, type: type.type, config: {} }))
    onCreate({ kind: 'widgets', id: (await res.json()).id })
  }
  return (
    <AppShell.Main className="editor" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Stack gap="xs" w={240}>
        <Heading title="New widget" />
        {types.map((t) => <Button key={t.type} variant="default" onClick={() => create(t)}>{t.label}</Button>)}
        <Button variant="default" onClick={() => importFile().then(onCreate, (err) => alert(`Import failed: ${err.message}`))}>Import JSON…</Button>
      </Stack>
    </AppShell.Main>
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
    <form onSubmit={send}>
      <Heading title="Test" />
      <Group gap="xs" mb="md">
        <NativeSelect size="xs" data={type.actions} value={action} onChange={(e) => setAction(e.target.value)} />
        <TextInput size="xs" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
        <TextInput size="xs" placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} />
        <Button size="xs" variant="default" type="submit">Send</Button>
      </Group>
    </form>
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
    <AppShell.Main className="editor">
      <Group gap="xs" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <TextInput flex={1} size="xs" value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="xs" variant="default" onClick={() => exportItem('widgets', widget.id).then((b) => download(b, name))}>Export</Button>
        <Button size="xs" variant="light" color="red" onClick={onDelete}>Delete widget</Button>
      </Group>
      <div style={{ flex: 1, minHeight: 0, padding: 'var(--mantine-spacing-sm)', overflow: 'auto' }}>
        <Heading title={type.label} />
        <Text size="sm" mb="md">OBS browser source: <Anchor href={url} target="_blank">{url}</Anchor></Text>
        <Fields defaults={type.config} values={config} onChange={setConfig} />
        <Test widget={widget} type={type} />
        <iframe className="preview" src={url} title="Preview" />
      </div>
    </AppShell.Main>
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
