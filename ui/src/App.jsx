// App shell: left workflow list and Twitch connection, center workflow editor. While editing a workflow: right library
// (node and widget types to drag onto the graph) and bottom settings of the selected node; both toggle and resize.
import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Affix, AppShell, Button, Center, Modal, NavLink, Stack, Switch, Text, Tooltip, useAppShellResize } from '@mantine/core'
import { IconPlus, IconTool } from '@tabler/icons-react'
import Workflow from './Workflow.jsx'
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

  // Switches a workflow on or off; off, its triggers ignore chat and API calls.
  const toggle = (item, enabled) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, enabled } : i)))
    fetch(`/api/${kind}/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
  }

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
          c={item.enabled === false ? 'dimmed' : undefined}
          active={selected?.id === item.id}
          onClick={() => onSelect({ kind, id: item.id })}
          leftSection={
            // The wrapper keeps a click on the switch from also opening the workflow.
            <span style={{ display: 'flex' }} onClick={(e) => e.stopPropagation()}>
              <Tooltip label={item.enabled === false ? 'Off: click to turn on' : 'On: click to turn off'} openDelay={400}>
                <Switch size="xs" checked={item.enabled !== false} onChange={(e) => toggle(item, e.currentTarget.checked)} />
              </Tooltip>
            </span>
          }
        />
      ))}
    </Stack>
  )
}

// Drag a node type or a widget type onto the graph; each widget dropped is a new instance.
function Library({ defs, types }) {
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
        <Heading title="Widget" />
        {types.map((t) => {
          const Icon = widgetIcons[t.type]
          return (
            <Tooltip key={t.type} label="Drag onto the graph to add a new overlay" position="left" openDelay={400}>
              <NavLink
                label={t.label}
                leftSection={Icon && <Icon size={18} color={colors.widget} />}
                draggable
                style={{ cursor: 'grab' }}
                onDragStart={(e) => e.dataTransfer.setData('application/ovrly-widget', t.type)}
              />
            </Tooltip>
          )
        })}
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
  // Developer mode, toggled with Ctrl+Shift+D (Ctrl on macOS too) and remembered by this browser.
  const [devMode, setDevMode] = useState(() => {
    try { return localStorage.getItem('ovrly-dev') === '1' } catch { return false }
  })
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey && e.shiftKey && e.code === 'KeyD')) return
      e.preventDefault()
      setDevMode((on) => {
        try { localStorage.setItem('ovrly-dev', on ? '0' : '1') } catch {}
        return !on
      })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  // Panels the user toggled on/off.
  const [panels, setPanels] = useState({ library: true })
  const togglePanel = (key) => setPanels((p) => ({ ...p, [key]: !p[key] }))
  // Workflow id -> id of its selected node, whose settings show in the bottom pane; kept when switching workflows.
  const [openNodes, setOpenNodes] = useState({})
  const resize = useAppShellResize({ aside: { min: 160, max: 480 }, footer: { min: 80, max: Math.round(innerHeight * 0.85) } })
  const editing = selected?.kind === 'workflows'
  const showAside = editing && panels.library
  // Panes don't slide when switching workflows: they just show the new workflow's state.
  const shown = useRef(selected?.id)
  const switched = shown.current !== selected?.id
  useEffect(() => {
    shown.current = selected?.id
  })

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
      transitionDuration={switched ? 0 : undefined}
      navbar={{ width: 220, breakpoint: 0 }}
      aside={{ width: 220, breakpoint: 0, collapsed: { desktop: !showAside, mobile: !showAside } }}
      // The settings pane opens at 60% of the window, enough for a widget's settings and preview; dragging resizes it.
      footer={{ height: Math.max(200, Math.round(innerHeight * 0.6)), collapsed: !(editing && openNodes[selected.id]) }}
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
          onWidgetChange={() => setVersion((v) => v + 1)}
          panels={panels}
          onToggle={togglePanel}
          openNode={openNodes[selected.id]}
          onNodeSelect={(nodeId) => setOpenNodes((o) => ({ ...o, [selected.id]: nodeId }))}
        />
      ) : (
        <AppShell.Main className="editor"><Center flex={1} c="dimmed">Select or create a workflow</Center></AppShell.Main>
      )}
      <AppShell.Aside>
        <div className="pane">
          <Library defs={defs} types={types} />
        </div>
      </AppShell.Aside>
      {devMode && (
        <Affix position={{ bottom: 16, right: 16 }}>
          <Tooltip label="Developer: recent events (opens a new tab)" position="left">
            <ActionIcon component="a" href="/api/events" target="_blank" size="lg" variant="default"><IconTool size={20} /></ActionIcon>
          </Tooltip>
        </Affix>
      )}
      <NewWorkflow opened={modal} onDone={onCreate} onClose={() => setModal(false)} />
    </AppShell>
  )
}
