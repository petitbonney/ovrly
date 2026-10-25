// App shell: left workflow list, integration statuses and settings button, center workflow editor. While editing a
// workflow: right library (node and widget types to drag onto the graph) and bottom settings of the selected node;
// both toggle and resize.
import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Affix, AppShell, Badge, Button, Center, Collapse, Divider, Group, Loader, Modal, NavLink, Notification, SimpleGrid, Stack, Switch, Text,
  TextInput, Tooltip, UnstyledButton, useAppShellResize,
} from '@mantine/core'
import { IconChevronRight, IconFile, IconFileImport, IconPlugOff, IconPlus, IconSearch, IconSettings, IconTool, IconUrgent, IconX } from '@tabler/icons-react'
import Workflow from './Workflow.jsx'
import TimerBar from './TimerBar.jsx'
import Settings, { StatusIcon, integrations, requirements, unmet, useStatuses } from './Settings.jsx'
import Heading from './Heading.jsx'
import { colors, withIcon } from './FlowNode.jsx'
import templates from './templates.js'
import { importBundle, importFile } from './share.js'
import { get, json } from './api.js'

// The workflows, each with its on/off switch (off: its triggers ignore chat and API calls) and a loader while it runs.
function List({ items, selected, onSelect, onAdd, onToggle }) {
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

  return (
    <Stack gap={0} className="library-section">
      <Heading title="Workflows">
        <Tooltip label="New workflow">
          <ActionIcon variant="default" size="sm" aria-label="New workflow" onClick={onAdd}><IconPlus size={14} /></ActionIcon>
        </Tooltip>
      </Heading>
      {items.map((item) => {
        const name = item.name || item.id
        const on = item.enabled !== false
        return (
          <NavLink
            key={item.id}
            label={<Text inherit truncate title={name}>{name}</Text>}
            rightSection={running[item.id] > 0 && <Loader size={10} />}
            c={on ? undefined : 'dimmed'}
            active={selected?.id === item.id}
            onClick={() => onSelect({ kind: 'workflows', id: item.id })}
            // A link without href isn't focusable: these are, and Enter opens them (not a button: the switch is inside).
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onSelect({ kind: 'workflows', id: item.id })}
            leftSection={
              // The wrapper keeps a click on the switch from also opening the workflow.
              <span style={{ display: 'flex' }} onClick={(e) => e.stopPropagation()}>
                <Tooltip label={on ? 'On: click to turn off' : 'Off: click to turn on'} openDelay={400}>
                  <Switch size="xs" color="green" aria-label={name} checked={on} onChange={(e) => onToggle(item, e.currentTarget.checked)} />
                </Tooltip>
              </span>
            }
          />
        )
      })}
    </Stack>
  )
}

// The statuses of the integrations set up (connected or failing), always in sight: a row each, opening its settings.
// Those not set up are only in the Settings dialog.
function Integrations({ statuses, onOpen }) {
  const shown = integrations.map((i) => ({ ...i, status: i.info(statuses[i.path]) })).filter((i) => i.status.state !== 'off')
  if (!shown.length) return null
  return (
    <Stack gap={0} mt="md" style={{ flexShrink: 0 }}>
      <Heading title="Integrations" />
      {shown.map((i) => (
        <NavLink key={i.key} component="button" label={i.label} onClick={() => onOpen(i.key)} rightSection={<StatusIcon info={i.status} />} />
      ))}
    </Stack>
  )
}

// A library section that folds open or closed from its title; this browser remembers the choice. First time, only
// the trigger section is open.
function Section({ title, forceOpen, children }) {
  const key = `ovrly-library-${title}`
  const [open, setOpen] = useState(() => {
    try { return (localStorage.getItem(key) ?? (title === 'trigger' ? 'open' : 'closed')) === 'open' } catch { return title === 'trigger' }
  })
  const toggle = () => {
    try { localStorage.setItem(key, open ? 'closed' : 'open') } catch {}
    setOpen(!open)
  }
  return (
    <Stack gap={0} className="library-section">
      <UnstyledButton onClick={toggle} mb="xs" aria-expanded={open}>
        <Group gap={4}>
          <IconChevronRight size={14} color="var(--mantine-color-dimmed)" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }} />
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{title}</Text>
        </Group>
      </UnstyledButton>
      <Collapse expanded={open || forceOpen}>{children}</Collapse>
    </Stack>
  )
}

// Tells the open workflow editor to add a library item.
const addToWorkflow = (detail) => window.dispatchEvent(new CustomEvent('ovrly-add', { detail }))

// A library item: dragged onto the graph, or added with a double-click or Enter. A node type whose needs aren't met
// (off: the requirement keys not met) shows a plug icon, as on the graph; its tooltip says what it needs.
function Item({ label, description, icon: Icon, color, needs = [], off, badge, data, onAdd }) {
  const missing = requirements.filter((r) => needs.includes(r.key) && off.includes(r.key))
  return (
    <Tooltip label={[description, ...missing.map((r) => `Needs ${r.needs}.`)].join(' ')} position="left" openDelay={400} multiline w={240}>
      <NavLink
        py={0}
        label={label}
        leftSection={Icon && <Icon size={18} color={color} />}
        rightSection={badge ?? (missing.length > 0 && <IconPlugOff size={14} color="var(--mantine-color-yellow-text)" aria-label={`Needs ${missing[0].needs}`} />)}
        draggable
        style={{ cursor: 'grab' }}
        tabIndex={0}
        onDragStart={(e) => e.dataTransfer.setData(...data)}
        onDoubleClick={onAdd}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
      />
    </Tooltip>
  )
}
const nodeItem = (d, color, off) => (
  <Item key={d.type} label={d.label} description={d.description} icon={d.Icon} color={color} needs={d.needs} off={off}
    data={['application/ovrly', d.type]} onAdd={() => addToWorkflow({ node: d.type })} />
)

// Library items under "—— Group ——" dividers; items without a group come first, with no divider.
function Groups({ items }) {
  const groups = [...Map.groupBy(items, (i) => i.group)].sort(([a], [b]) => !b - !a)
  return groups.map(([group, list]) => (
    <Fragment key={group ?? ''}>
      {group && <Divider label={group} labelPosition="center" my={0} />}
      {list.map((i) => i.el)}
    </Fragment>
  ))
}

// Drag a node type or a widget type onto the graph; each widget dropped is a new instance.
function Library({ defs, types, off }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const match = (d) => !q || d.label.toLowerCase().includes(q)
  return (
    <>
      <TextInput
        mb="md" size="xs" placeholder="Search nodes" aria-label="Search nodes" value={query} onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<IconSearch size={14} />}
        rightSection={query && <ActionIcon size="xs" variant="subtle" color="gray" aria-label="Clear search" onClick={() => setQuery('')}><IconX size={14} /></ActionIcon>}
      />
      {['trigger', 'logic', 'action'].map((category) => {
        const items = defs.filter((d) => d.category === category && match(d))
        return items.length > 0 && (
        <Section key={category} title={category} forceOpen={!!q}>
          <Groups items={items.map((d) => ({ group: d.group, el: nodeItem(d, colors[category], off) }))} />
        </Section>
        )
      })}
      {(types.some(match) || defs.some((d) => d.category === 'widget' && d.type !== 'widget' && match(d))) && <Section title="Widget" forceOpen={!!q}>
        {/* Widget types first; widget node types (Merge Widgets) last. The widget node itself is created by dropping a widget type. */}
        <Groups items={[
          ...types.filter(match).map((t) => ({ el: (
            <Item key={t.type} label={t.label} description={t.soon ? `Coming soon. ${t.description}` : t.description} icon={t.Icon}
              color={colors.widget} needs={t.needs} off={off} badge={t.soon && <Badge size="xs" variant="light" color="yellow">Soon</Badge>}
              data={['application/ovrly-widget', t.type]} onAdd={() => addToWorkflow({ widget: t.type })} />
          ) })),
          ...defs.filter((d) => d.category === 'widget' && d.type !== 'widget' && match(d))
            .map((d) => ({ group: d.group, el: nodeItem(d, colors.widget, off) })),
        ]} />
      </Section>}
    </>
  )
}

// A choice in the "New workflow" modal: a title and, for a template, a one-line description.
function Choice({ title, description, icon: Icon, onClick }) {
  return (
    <Button variant="default" justify="start" h="auto" py="xs" onClick={onClick} leftSection={Icon && <Icon size={20} />}>
      <div style={{ textAlign: 'left', whiteSpace: 'normal' }}>
        <Text fw={700} size="sm">{title}</Text>
        {description && <Text size="xs" c="dimmed">{description}</Text>}
      </div>
    </Button>
  )
}

// "New workflow" modal: blank or imported from a JSON file side by side, then the templates (if any). Calls onDone
// with { kind, id }.
function NewWorkflow({ opened, onDone, onClose }) {
  const blank = { workflows: [{ name: 'New workflow', nodes: [], edges: [] }] }
  return (
    <Modal opened={opened} onClose={onClose} title="New workflow" size="md">
      <Stack gap="xs">
        <SimpleGrid cols={2} spacing="xs">
          <Choice title="Blank" icon={IconFile} onClick={() => importBundle(blank).then(onDone)} />
          <Choice title="Import JSON…" icon={IconFileImport}
            onClick={() => importFile().then(onDone, (err) => alert(`Import failed: ${err.message}`))} />
        </SimpleGrid>
        {templates.length > 0 && (
          <>
            <Divider my="xs" />
            <Heading title="Templates" />
            {templates.map((t) => (
              <Choice key={t.name} title={t.name} description={t.description} onClick={() => importBundle(t).then(onDone)} />
            ))}
          </>
        )}
      </Stack>
    </Modal>
  )
}

// theme, onTheme: the editor theme's name and its setter (main.jsx).
export default function App({ theme, onTheme }) {
  const [selected, setSelected] = useState(null)
  const [defs, setDefs] = useState([])
  const [types, setTypes] = useState([])
  const [widgets, setWidgets] = useState([])
  const [workflows, setWorkflows] = useState([])
  // Bumped to make the lists refetch after a change.
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    get('/api/nodes').then((list) => setDefs(list.map(withIcon)))
    get('/api/widget-types').then((list) => setTypes(list.map(withIcon)))
  }, [])
  useEffect(() => {
    get('/api/widgets').then(setWidgets)
    get('/api/workflows').then(setWorkflows)
  }, [version])

  // Integration statuses, and the requirements (`needs`) they leave unmet, for the library, the graph and settings.
  const [statuses, setStatus] = useStatuses()
  const off = unmet(statuses)

  const [modal, setModal] = useState(false)
  // The Settings dialog and its pane; anything can open it with openSettings(item) (Settings.jsx).
  const [settings, setSettings] = useState({ opened: false, item: 'twitch' })
  const showSettings = (item) => setSettings((s) => ({ opened: true, item: item ?? s.item }))
  useEffect(() => {
    const onOpen = (e) => showSettings(e.detail)
    window.addEventListener('ovrly-settings', onOpen)
    return () => window.removeEventListener('ovrly-settings', onOpen)
  }, [])
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
  // Panels the user toggled on/off. The library starts hidden in a narrow window, leaving the graph room.
  const [panels, setPanels] = useState({ library: innerWidth >= 1100 })
  const togglePanel = (key) => setPanels((p) => ({ ...p, [key]: !p[key] }))
  // Workflow id -> id of its selected node, whose settings show in the bottom pane; kept when switching workflows.
  const [openNodes, setOpenNodes] = useState({})
  // Pane sizes the user dragged, kept by this browser.
  const [initialSizes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ovrly-panes')) ?? undefined } catch {}
  })
  const resize = useAppShellResize({
    aside: { min: 160, max: 480 },
    footer: { min: 80, max: Math.round(innerHeight * 0.85) },
    initialSizes,
    onResizeEnd: (sizes) => {
      try { localStorage.setItem('ovrly-panes', JSON.stringify(sizes)) } catch {}
    },
  })
  const editing = selected?.kind === 'workflows'
  const showAside = editing && panels.library
  // Panes don't slide when switching workflows: they just show the new workflow's state.
  const shown = useRef(selected?.id)
  const switched = shown.current !== selected?.id
  useEffect(() => {
    shown.current = selected?.id
  })

  // Switches a workflow on or off; off, its triggers ignore chat and API calls.
  const toggle = (item, enabled) => {
    setWorkflows((list) => list.map((i) => (i.id === item.id ? { ...i, enabled } : i)))
    fetch(`/api/workflows/${item.id}`, json('PUT', { enabled }))
  }
  // Emergency stop: every workflow off, runs cancelled; the workflows it switched off can be turned back on at once.
  const [stopped, setStopped] = useState([])
  const stopAll = () => fetch('/api/stop', { method: 'POST' }).then((r) => r.json()).then(({ off }) => {
    setStopped(off)
    refresh()
  })
  useEffect(() => {
    if (!stopped.length) return
    const t = setTimeout(() => setStopped([]), 5000)
    return () => clearTimeout(t)
  }, [stopped])
  const undoStop = () => {
    Promise.all(stopped.map((id) => fetch(`/api/workflows/${id}`, json('PUT', { enabled: true })))).then(refresh)
    setStopped([])
  }
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
      // The settings pane opens at 45% of the window, leaving room for the graph; dragging resizes it.
      footer={{ height: Math.max(200, Math.round(innerHeight * 0.45)), collapsed: !(editing && openNodes[selected.id]) }}
    >
      <AppShell.Navbar p="sm">
        {/* The stop button sits at the bottom of the workflows section, below however many workflows there are. */}
        <AppShell.Section grow style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <List items={workflows} selected={selected} onSelect={setSelected} onAdd={() => setModal(true)} onToggle={toggle} />
          <Tooltip label="Emergency: switches every workflow off and cancels what is running" openDelay={400}>
            <Button color="red" variant="light" size="xs" fullWidth mt="auto" mb={0} style={{ flexShrink: 0 }} aria-label="Emergency: switch every workflow off" onClick={stopAll}>
              <IconUrgent size={20} />
              <Text ml={6} fw={700} size="xs">EMERGENCY</Text>
            </Button>
          </Tooltip>
          <Integrations statuses={statuses} onOpen={showSettings} />
          <Button variant="default" size="xs" fullWidth mt="xs" style={{ flexShrink: 0 }} leftSection={<IconSettings size={16} />} onClick={() => showSettings()}>
            Settings
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>
      {editing ? (
        <Workflow
          key={selected.id}
          id={selected.id}
          defs={defs}
          widgets={widgets}
          types={types}
          off={off}
          onChange={onItemChange}
          onWidgetChange={refresh}
          panels={panels}
          onToggle={togglePanel}
          openNode={openNodes[selected.id]}
          onNodeSelect={(nodeId) => setOpenNodes((o) => ({ ...o, [selected.id]: nodeId }))}
        />
      ) : (
        <AppShell.Main className="editor">
          <Center flex={1}>
            <Stack align="center" gap="sm">
              <Text c="dimmed">Pick a workflow on the left, or start a new one.</Text>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>New workflow</Button>
            </Stack>
          </Center>
        </AppShell.Main>
      )}
      <AppShell.Aside>
        <div className="pane">
          <Library defs={defs} types={types} off={off} />
        </div>
      </AppShell.Aside>
      {stopped.length > 0 && (
        <Affix position={{ bottom: 16, left: 236 }}>
          <Notification className="timed" color="red" withCloseButton={false}>
            <Group gap="xl" wrap="nowrap">
              <div>
                <Text size="sm" fw={500} c="var(--mantine-color-text)">EMERGENCY</Text>
                <Text size="sm">{stopped.length === 1 ? 'One workflow' : `${stopped.length} workflows`} switched off.</Text>
              </div>
              <Button size="compact-xs" variant="light" onClick={undoStop}>Undo</Button>
            </Group>
            <TimerBar key={stopped.join()} ms={5000} />
          </Notification>
        </Affix>
      )}
      {devMode && (
        <Affix position={{ bottom: 16, right: 16 }}>
          <Tooltip label="Developer: recent events (opens a new tab)" position="left">
            <ActionIcon component="a" href="/api/events" target="_blank" size="lg" variant="default" aria-label="Recent events"><IconTool size={20} /></ActionIcon>
          </Tooltip>
        </Affix>
      )}
      <Settings
        opened={settings.opened} item={settings.item} onItem={(item) => setSettings({ opened: true, item })} onClose={() => setSettings((s) => ({ ...s, opened: false }))}
        statuses={statuses} setStatus={setStatus} theme={theme} onTheme={onTheme}
      />
      <NewWorkflow opened={modal} onDone={onCreate} onClose={() => setModal(false)} />
    </AppShell>
  )
}
