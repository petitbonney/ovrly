// App shell: left workflow list and integrations (Twitch, OBS), center workflow editor. While editing a workflow: right library
// (node and widget types to drag onto the graph) and bottom settings of the selected node; both toggle and resize.
import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Affix, AppShell, Badge, Button, Center, Collapse, Divider, Group, Loader, Modal, NavLink, SimpleGrid, Stack, Switch, Text,
  Tooltip, UnstyledButton, useAppShellResize,
} from '@mantine/core'
import { IconChevronRight, IconFile, IconFileImport, IconPlus, IconSos, IconTool } from '@tabler/icons-react'
import Workflow from './Workflow.jsx'
import Integrations from './Integrations.jsx'
import Heading from './Heading.jsx'
import { icons, colors, widgetIcons } from './FlowNode.jsx'
import templates from './templates.js'
import { importBundle, importFile } from './share.js'
import { get, json } from './api.js'

function List({ title, kind, selected, onSelect, onAdd, version }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    get(`/api/${kind}`).then(setItems)
  }, [kind, version])
  // Workflow id -> firings in progress, from the engine's live activity: a loader shows next to running workflows.
  const [running, setRunning] = useState({})
  useEffect(() => {
    const source = new EventSource('/api/activity')
    source.onmessage = (e) => {
      const a = JSON.parse(e.data)
      if ('running' in a) setRunning((r) => ({ ...r, [a.workflow]: a.running }))
    }
    return () => source.close()
  }, [])

  // Switches a workflow on or off; off, its triggers ignore chat and API calls.
  const toggle = (item, enabled) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, enabled } : i)))
    fetch(`/api/${kind}/${item.id}`, json('PUT', { enabled }))
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
          rightSection={running[item.id] > 0 && <Loader size={10} />}
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

// A library section that folds open or closed from its title; this browser remembers which ones are closed.
function Section({ title, children }) {
  const key = `ovrly-library-${title}`
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(key) !== 'closed' } catch { return true }
  })
  const toggle = () => {
    try { localStorage.setItem(key, open ? 'closed' : 'open') } catch {}
    setOpen(!open)
  }
  return (
    <Stack gap={0} mb="md">
      <UnstyledButton onClick={toggle} mb="xs" aria-expanded={open}>
        <Group gap={4}>
          <IconChevronRight size={14} color="var(--mantine-color-dimmed)" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }} />
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{title}</Text>
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}>{children}</Collapse>
    </Stack>
  )
}

// Drag a node type or a widget type onto the graph; each widget dropped is a new instance.
function Library({ defs, types }) {
  return (
    <>
      {['trigger', 'logic', 'action'].map((category) => (
        <Section key={category} title={category}>
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
        </Section>
      ))}
      <Section title="Widget">
        {types.map((t) => {
          const Icon = widgetIcons[t.type]
          return (
            <Tooltip key={t.type} label={t.soon ? `Coming soon. ${t.description}` : t.description} position="left" openDelay={400} multiline w={240}>
              <NavLink
                label={t.label}
                leftSection={Icon && <Icon size={18} color={colors.widget} />}
                rightSection={t.soon && <Badge size="xs" variant="light" color="yellow">Soon</Badge>}
                draggable
                style={{ cursor: 'grab' }}
                onDragStart={(e) => e.dataTransfer.setData('application/ovrly-widget', t.type)}
              />
            </Tooltip>
          )
        })}
      </Section>
    </>
  )
}

// A choice in the "New workflow" modal: a title and a one-line description.
function Choice({ title, description, icon: Icon, onClick }) {
  return (
    <Button variant="default" justify="start" h="auto" py="xs" onClick={onClick} leftSection={Icon && <Icon size={20} />}>
      <div style={{ textAlign: 'left', whiteSpace: 'normal' }}>
        <Text fw={700} size="sm">{title}</Text>
        <Text size="xs" c="dimmed">{description}</Text>
      </div>
    </Button>
  )
}

// "New workflow" modal: blank or imported from a JSON file side by side, then the templates. Calls onDone with
// { kind, id }.
function NewWorkflow({ opened, onDone, onClose }) {
  const blank = { workflows: [{ name: 'New workflow', nodes: [], edges: [] }] }
  return (
    <Modal opened={opened} onClose={onClose} title="New workflow" size="md">
      <Stack gap="xs">
        <SimpleGrid cols={2} spacing="xs">
          <Choice title="Blank" description="Start from an empty graph." icon={IconFile} onClick={() => importBundle(blank).then(onDone)} />
          <Choice title="Import JSON…" description="Open a workflow exported from Ovrly, with its widgets." icon={IconFileImport}
            onClick={() => importFile().then(onDone, (err) => alert(`Import failed: ${err.message}`))} />
        </SimpleGrid>
        <Divider my="xs" />
        <Heading title="Templates" />
        {templates.map((t) => (
          <Choice key={t.name} title={t.name} description={t.description} onClick={() => importBundle(t).then(onDone)} />
        ))}
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
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    get('/api/nodes').then(setDefs)
    get('/api/widget-types').then(setTypes)
  }, [])
  useEffect(() => {
    get('/api/widgets').then(setWidgets)
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

  // Emergency stop: every workflow off, runs cancelled; the list refetches to show the switches off.
  const stopAll = () => fetch('/api/stop', { method: 'POST' }).then(refresh)
  // Called by the editors after a save (id) or a delete (null).
  const onItemChange = (id) => {
    if (!id) setSelected(null)
    refresh()
  }
  // Called after creating or importing a workflow ({ kind, id }); an import with no workflow selects nothing.
  const onCreate = (item) => {
    setModal(false)
    setSelected(item?.kind === 'workflows' ? item : null)
    refresh()
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
        <AppShell.Section pb="sm" mb="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
          <Integrations />
        </AppShell.Section>
        {/* The stop button sits at the bottom of the workflows section, below however many workflows there are. */}
        <AppShell.Section grow style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <List title="Workflows" kind="workflows" selected={selected} onSelect={setSelected} onAdd={() => setModal(true)} version={version} />
          <Tooltip label="Switches every workflow off and cancels what is running" openDelay={400}>
            <Button color="red" variant="light" size="xs" fullWidth mt="auto" mb={0} style={{ flexShrink: 0 }} onClick={stopAll}>
              <IconSos size={24} />
            </Button>
          </Tooltip>
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
          onWidgetChange={refresh}
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
