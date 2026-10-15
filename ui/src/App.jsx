// App shell: left workflow list and Twitch connection, center workflow editor. While editing a workflow: right library
// (node types and widgets to drag onto the graph) and bottom settings of the selected node; both toggle and resize.
// Widgets are created and edited in a dialog.
import { useEffect, useState } from 'react'
import { ActionIcon, AppShell, Button, Center, Modal, NavLink, Stack, Text, Tooltip, useAppShellResize } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import Workflow from './Workflow.jsx'
import WidgetModal from './Widget.jsx'
import { Twitch } from './Chat.jsx'
import Heading from './Heading.jsx'
import { icons, colors, widgetIcons } from './FlowNode.jsx'
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
        <Tooltip label={kind === 'widgets' ? 'New widget' : 'New workflow'}>
          <ActionIcon variant="default" size="sm" onClick={onAdd}><IconPlus size={14} /></ActionIcon>
        </Tooltip>
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

// Drag a node type or a widget onto the graph; click a widget to edit it.
function Library({ defs, widgets, onAddWidget, onEditWidget }) {
  return (
    <>
      {['trigger', 'logic', 'action'].map((category) => (
        <Stack key={category} gap={0} mb="md">
          <Heading title={category} />
          {defs.filter((d) => d.category === category).map((d) => {
            const Icon = icons[d.type]
            return (
              <Tooltip key={d.type} label={d.description} position="left" openDelay={400} multiline w={240}>
                <NavLink
                  label={d.label}
                  leftSection={Icon && <Icon size={18} color={colors[category]} />}
                  draggable
                  style={{ cursor: 'grab' }}
                  onDragStart={(e) => e.dataTransfer.setData('application/ovrly', d.type)}
                />
              </Tooltip>
            )
          })}
        </Stack>
      ))}
      <Stack gap={0} mb="md">
        <Heading title="Widgets">
          <Tooltip label="New widget">
            <ActionIcon variant="default" size="sm" onClick={onAddWidget}><IconPlus size={14} /></ActionIcon>
          </Tooltip>
        </Heading>
        {widgets.map((w) => {
          const Icon = widgetIcons[w.type]
          return (
            <Tooltip key={w.id} label="Drag onto the graph, click to edit" position="left" openDelay={400}>
              <NavLink
                label={w.name}
                leftSection={Icon && <Icon size={18} color={colors.widget} />}
                draggable
                style={{ cursor: 'grab' }}
                onDragStart={(e) => e.dataTransfer.setData('application/ovrly-widget', w.id)}
                onClick={() => onEditWidget(w.id)}
              />
            </Tooltip>
          )
        })}
        {widgets.length === 0 && <Text size="xs" c="dimmed">No widgets yet</Text>}
      </Stack>
    </>
  )
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
  const [widgets, setWidgets] = useState([])
  // Bumped to make the lists refetch after a change.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    fetch('/api/nodes').then((r) => r.json()).then(setDefs)
    fetch('/api/widget-types').then((r) => r.json()).then(setTypes)
  }, [])
  useEffect(() => {
    fetch('/api/widgets').then((r) => r.json()).then(setWidgets)
  }, [version])

  const [modal, setModal] = useState(false)
  const [widgetModal, setWidgetModal] = useState(null) // widget id, 'new', or null
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
  // Called after creating or importing a workflow ({ kind, id }); an import with no workflow selects nothing.
  const onCreate = (item) => {
    setModal(false)
    setSelected(item?.kind === 'workflows' ? item : null)
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
      <AppShell.Navbar p="sm">
        <AppShell.Section grow style={{ overflow: 'auto' }}>
          <List title="Workflows" kind="workflows" selected={selected} onSelect={setSelected} onAdd={() => setModal(true)} version={version} />
        </AppShell.Section>
        <AppShell.Section pt="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
          <Twitch />
        </AppShell.Section>
      </AppShell.Navbar>
      {editing ? (
        <Workflow
          key={selected.id}
          id={selected.id}
          defs={defs}
          widgets={widgets}
          types={types}
          onChange={onItemChange}
          onEditWidget={setWidgetModal}
          panels={panels}
          onToggle={togglePanel}
          onNodeSelect={setNodeSelected}
        />
      ) : (
        <AppShell.Main className="editor"><Center flex={1} c="dimmed">Select or create a workflow</Center></AppShell.Main>
      )}
      <AppShell.Aside p="sm" style={{ overflow: 'auto' }}>
        <Library defs={defs} widgets={widgets} onAddWidget={() => setWidgetModal('new')} onEditWidget={setWidgetModal} />
      </AppShell.Aside>
      <NewWorkflow opened={modal} onDone={onCreate} onClose={() => setModal(false)} />
      <WidgetModal
        id={widgetModal}
        types={types}
        onOpen={setWidgetModal}
        onClose={() => setWidgetModal(null)}
        onChange={() => setVersion((v) => v + 1)}
      />
    </AppShell>
  )
}
