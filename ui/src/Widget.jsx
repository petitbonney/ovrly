// Widget dialog: picks a type for a new widget, or edits one (settings, test actions, live preview), autosaved.
import { useEffect, useState } from 'react'
import {
  ActionIcon, Anchor, Button, CopyButton, Group, Modal, SegmentedControl, Stack, Text, TextInput, Tooltip,
} from '@mantine/core'
import { IconCheck, IconCopy, IconDownload, IconTrash } from '@tabler/icons-react'
import Fields from './Fields.jsx'
import Heading from './Heading.jsx'
import { widgetIcons } from './FlowNode.jsx'
import { exportItem, download, importFile } from './share.js'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// Calls onCreate(id) with the new widget; the server picks a free name ("Alerts 2").
function NewWidget({ types, onCreate }) {
  const create = async (type) => {
    const res = await fetch('/api/widgets', json('POST', { name: type.label, type: type.type, config: {} }))
    onCreate((await res.json()).id)
  }
  return (
    <Stack gap="xs">
      {types.map((t) => {
        const Icon = widgetIcons[t.type]
        return <Button key={t.type} variant="default" justify="start" leftSection={Icon && <Icon size={18} />} onClick={() => create(t)}>{t.label}</Button>
      })}
      <Button variant="default" justify="start" onClick={() => importFile().then((item) => onCreate(item?.kind === 'widgets' ? item.id : null), (err) => alert(`Import failed: ${err.message}`))}>
        Import JSON…
      </Button>
    </Stack>
  )
}

// Fires one widget action by hand, like a widget node would.
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
        <SegmentedControl size="xs" data={type.actions} value={action} onChange={setAction} />
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
  const [error, setError] = useState(null)

  // Debounced autosave; the server pushes the new config to open overlays and refuses a name already in use.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/widgets/${widget.id}`, json('PUT', { name, type: widget.type, config }))
      setError(res.ok ? null : (await res.json()).error)
      if (res.ok) onChange()
    }, 500)
    return () => clearTimeout(timer)
  }, [name, config])

  const url = `${location.origin}/w/${widget.id}`
  return (
    <>
      <Group gap="xs" mb="md" align="start">
        <TextInput flex={1} size="xs" value={name} error={error} onChange={(e) => setName(e.target.value)} />
        <Tooltip label="Export as JSON">
          <ActionIcon size="md" variant="default" onClick={() => exportItem('widgets', widget.id).then((b) => download(b, name))}><IconDownload size={18} /></ActionIcon>
        </Tooltip>
        <Tooltip label="Delete widget">
          <ActionIcon size="md" variant="light" color="red" onClick={onDelete}><IconTrash size={18} /></ActionIcon>
        </Tooltip>
      </Group>
      <Group gap={6} mb="md">
        <Text size="sm">OBS browser source:</Text>
        <Tooltip label="Open in a new tab"><Anchor size="sm" href={url} target="_blank">{url}</Anchor></Tooltip>
        <CopyButton value={url}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy link'}>
              <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Heading title="Settings" />
      <Stack mb="md"><Fields defaults={type.config} values={config} onChange={setConfig} /></Stack>
      <Test widget={widget} type={type} />
      <iframe className="preview" src={url} title="Preview" />
    </>
  )
}

// id: a widget id to edit, 'new' to pick a type, or null when closed. onChange(id | null) after a save or delete.
export default function WidgetModal({ id, types, onOpen, onClose, onChange }) {
  const [widget, setWidget] = useState(null)
  useEffect(() => {
    setWidget(null)
    if (id && id !== 'new') fetch(`/api/widgets/${id}`).then((r) => r.json()).then(setWidget)
  }, [id])

  const onDelete = async () => {
    await fetch(`/api/widgets/${id}`, { method: 'DELETE' })
    onChange(null)
    onClose()
  }

  const type = types.find((t) => t.type === widget?.type)
  return (
    <Modal opened={!!id} onClose={onClose} size={id === 'new' ? 'sm' : 'xl'} title={id === 'new' ? 'New widget' : type?.label}>
      {id === 'new' && <NewWidget types={types} onCreate={(newId) => { onChange(newId); newId ? onOpen(newId) : onClose() }} />}
      {widget && type && <Editor key={widget.id} widget={widget} type={type} onChange={() => onChange(id)} onDelete={onDelete} />}
    </Modal>
  )
}
