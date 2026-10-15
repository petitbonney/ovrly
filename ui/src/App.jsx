// App shell: left lists, center editor (workflow or widget). While editing a workflow: right node library and chat
// panels, and bottom config of the selected node; both can be toggled and resized.
import { useEffect, useState } from 'react'
import { ActionIcon, AppShell, Button, Center, Modal, NavLink, Stack, Text, useAppShellResize } from '@mantine/core'
import Workflow from './Workflow.jsx'
import Widget, { NewWidget } from './Widget.jsx'
import { Twitch, ChatTest } from './Chat.jsx'
import Heading from './Heading.jsx'
import templates from './templates.js'
import { importBundle, importFile } from './share.js'

function List({ title, kind, selected, onSelect, onAdd, version }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch(`/api/${kind}`).then((r) => r.json()).then(setItems)
  }, [kind, version])

  return (
    <Stack gap={0} mb="md">
      <Heading title={title}>
        <ActionIcon variant="default" size="sm" title={`New ${kind}`} onClick={onAdd}>+</ActionIcon>
      </Heading>
      {items.map((item) => (
        <NavLink
          key={item.id}
          label={item.name || item.id}
          active={selected?.id === item.id}
          onClick={() => onSelect({ kind, id: item.id })}
        />
      ))}
    </Stack>
  )
}

function Library({ defs }) {
  return ['trigger', 'logic', 'action'].map((category) => (
    <Stack key={category} gap={0} mb="md">
      <Heading title={category} />
      {defs.filter((d) => d.category === category).map((d) => (
        <NavLink
          key={d.type}
          label={d.label}
          draggable
          style={{ cursor: 'grab' }}
          onDragStart={(e) => e.dataTransfer.setData('application/ovrly', d.type)}
        />
      ))}
    </Stack>
  ))
}

// "New workflow" modal: blank, from a template, or imported from a JSON file. Calls onDone with { kind, id }.
function NewWorkflow({ opened, onDone, onClose }) {
  const blank = { workflows: [{ name: 'New workflow', nodes: [], edges: [] }] }
  return (
    <Modal opened={opened} onClose={onClose} title="New workflow" size="sm">
      <Stack gap="xs">
        <Button variant="default" justify="start" onClick={() => importBundle(blank).then(onDone)}>Blank</Button>
        {templates.map((t) => (
          <Button key={t.name} variant="default" justify="start" h="auto" py="xs" onClick={() => importBundle(t).then(onDone)}>
            <div style={{ textAlign: 'left', whiteSpace: 'normal' }}>
              <Text fw={700} size="sm">{t.name}</Text>
              <Text size="xs" c="dimmed">{t.description}</Text>
            </div>
          </Button>
        ))}
        <Button variant="default" justify="start" onClick={() => importFile().then(onDone, (err) => alert(`Import failed: ${err.message}`))}>
          Import JSON…
        </Button>
      </Stack>
    </Modal>
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
  // Panels the user toggled on/off, and whether the workflow editor has a node selected.
  const [panels, setPanels] = useState({ library: true, config: true })
  const togglePanel = (key) => setPanels((p) => ({ ...p, [key]: !p[key] }))
  const [nodeSelected, setNodeSelected] = useState(false)
  const resize = useAppShellResize({ aside: { min: 160, max: 480 }, footer: { min: 80, max: 600 } })
  const editing = selected?.kind === 'workflows'
  const showAside = editing && panels.library

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

  // "alt" layout: the sidebars take the full height and the footer (node config) sits between them.
  return (
    <AppShell
      layout="alt"
      resize={resize}
      navbar={{ width: 220, breakpoint: 0 }}
      aside={{ width: 220, breakpoint: 0, collapsed: { desktop: !showAside, mobile: !showAside } }}
      footer={{ height: 200, collapsed: !(editing && nodeSelected && panels.config) }}
    >
      <AppShell.Navbar p="sm" style={{ overflow: 'auto' }}>
        <List title="Widgets" kind="widgets" selected={selected} onSelect={setSelected} onAdd={() => setSelected({ kind: 'new-widget' })} version={version} />
        <List title="Workflows" kind="workflows" selected={selected} onSelect={setSelected} onAdd={() => setModal(true)} version={version} />
      </AppShell.Navbar>
      {selected?.kind === 'workflows' ? (
        <Workflow key={selected.id} id={selected.id} defs={defs} onChange={onItemChange} panels={panels} onToggle={togglePanel} onNodeSelect={setNodeSelected} />
      ) : selected?.kind === 'widgets' ? (
        <Widget key={selected.id} id={selected.id} types={types} onChange={onItemChange} />
      ) : selected?.kind === 'new-widget' ? (
        <NewWidget types={types} onCreate={onCreate} />
      ) : (
        <AppShell.Main className="editor"><Center flex={1} c="dimmed">Select a widget or workflow</Center></AppShell.Main>
      )}
      <AppShell.Aside p="sm" style={{ overflow: 'auto' }}>
        <Library defs={defs} />
        <Twitch />
        <ChatTest />
      </AppShell.Aside>
      <NewWorkflow opened={modal} onDone={onCreate} onClose={() => setModal(false)} />
    </AppShell>
  )
}
