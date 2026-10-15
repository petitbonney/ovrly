// Workflow editor: ReactFlow graph (center) and selected node settings (bottom), autosaved.
// Nodes are dropped from the library: node types, or widget types (each drop creates a widget instance and its widget
// node). A widget node's diamond links to Fire Widget nodes' diamond inputs: the widget node is the "what", each
// Fire Widget node a "how" (an action). Ctrl/Cmd+C and Ctrl/Cmd+V copy nodes, also into another workflow; pasted
// widget nodes share the same instance, which has one widget node per workflow. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) undo and redo graph edits.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, ControlButton, MarkerType,
  useNodesState, useEdgesState, addEdge, useReactFlow, useNodes, useEdges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ActionIcon, AppShell, Button, Code, Divider, Group, Modal, Notification, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconArrowBackUp, IconArrowForwardUp, IconDownload, IconLayoutSidebarRight, IconLock, IconLockOpen, IconPlayerPlay, IconSitemap,
  IconTrash,
} from '@tabler/icons-react'
import Fields from './Fields.jsx'
import WidgetSettings from './Widget.jsx'
import FlowNode, { colors, icons, widgetIcons } from './FlowNode.jsx'
import layout from './layout.js'
import { ChatTest } from './Chat.jsx'
import { exportWorkflow, download } from './share.js'

const findWidget = (widgets, ref) => widgets.find((w) => w.id === ref || w.name === ref)
// Widget links join a widget node's diamond to a Fire Widget node's diamond input; they carry no data.
const isLink = (e) => e.sourceHandle === 'widget'
// The widget instance a node drives: a widget node's own, or the one linked to a Fire Widget node's diamond input.
function widgetRef(node, nodes, edges) {
  if (node?.data.type === 'widget') return node.data.config.widget
  const link = edges.find((e) => e.target === node?.id && e.targetHandle === 'widget')
  return nodes.find((n) => n.id === link?.source)?.data.config.widget
}

// Copied nodes and the edges between them; kept in memory so they can be pasted into another workflow.
let clipboard = null
// Widget id -> last known widget instance. The server deletes an instance with its last node; undo or paste
// puts it back from here.
const knownWidgets = {}

// Data keys a node can use as {key}: what every node upstream of it adds (a manual trigger adds its JSON's keys,
// a Fire Widget node what its widget type outputs).
function upstreamKeys(id, { nodes, edges, defs, widgets, types }) {
  const keys = new Set()
  const seen = new Set()
  const queue = [id]
  while (queue.length) {
    const target = queue.pop()
    for (const e of edges.filter((e) => e.target === target && !isLink(e))) {
      if (seen.has(e.source)) continue
      seen.add(e.source)
      queue.push(e.source)
      const node = nodes.find((n) => n.id === e.source)
      const def = defs.find((d) => d.type === node?.data.type)
      const type = def?.widgetInput && types.find((t) => t.type === findWidget(widgets, widgetRef(node, nodes, edges))?.type)
      for (const k of [...(def?.adds ?? []), ...(type?.adds ?? [])]) keys.add(k)
      if (def?.type === 'manual') {
        try { Object.keys(JSON.parse(node.data.config.data ?? def.config.data)).forEach((k) => keys.add(k)) } catch {}
      }
    }
  }
  return [...keys]
}

// Every node is drawn by FlowNode ("step"); edges get an arrow like n8n.
// Diamond connectors (handle "widget") only connect to each other.
const isValidConnection = (c) => (c.sourceHandle === 'widget') === (c.targetHandle === 'widget')
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '#9a9a9a' } }
// Fitting the graph (on open and with the fit view button) never zooms past 100%, so a small graph isn't blown up.
const fitOptions = { maxZoom: 1, padding: 0.3 }

// Settings of the selected node: title, description, then a form built from the node type's fields.
// A widget node shows its widget instance's settings and preview; a Fire Widget node its linked widget, then the
// action to run on it (context.widget).
function Config({ node, def, context, onChange, onWidgetChange, onCopy }) {
  if (!node || !def) return null
  const isWidget = def.type === 'widget'
  const widget = context.widget
  const type = widget && context.types.find((t) => t.type === widget.type)
  const Icon = (isWidget ? widgetIcons[widget?.type] : icons[def.type]) ?? icons.log
  const fields = <Fields defaults={def.config} values={node.data.config} fields={def.fields} context={context} onChange={onChange} />
  return (
    <AppShell.Footer>
      <div className={isWidget && type ? 'pane split' : 'pane'}>
        <Group gap="xs" mb={4}>
          <Icon size={20} color={colors[def.category]} />
          <Text fw={600}>{isWidget ? widget?.name ?? 'Missing widget' : def.label}</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">{def.description}</Text>
        {isWidget ? (
          type ? <WidgetSettings key={widget.id} widget={widget} type={type} onChange={onWidgetChange} onCopy={onCopy} />
            : <Text size="sm" c="red">This widget was deleted. Drop a new one from the library.</Text>
        ) : def.widgetInput && !widget ? (
          <Text size="sm" c="dimmed">Link a widget node to the diamond input under this node, then pick the action to run.</Text>
        ) : (
          <>
            {def.widgetInput && (
              <Stack gap={2} mb="sm">
                <Text size="sm" fw={500}>{widget.name}</Text>
                <Group gap={6} wrap="nowrap">
                  <Text size="xs" c="dimmed">Instance ID</Text>
                  <Code>{widget.id}</Code>
                </Group>
              </Stack>
            )}
            {fields}
          </>
        )}
        {def.event === 'chat' && (
          // A !command trigger's test message starts with its command.
          <Stack mt="md"><ChatTest key={node.id} message={def.type === 'chat-command' ? `${node.data.config.command ?? def.config.command} ` : 'hello'} /></Stack>
        )}
      </div>
    </AppShell.Footer>
  )
}

// openNode: id of the node whose settings were open last time; onNodeSelect(id | null) reports selection changes.
function Editor({ workflow, defs, widgets, types, openNode, onRename, onDelete, onWidgetChange, panels, onToggle, onNodeSelect }) {
  const [name, setName] = useState(workflow.name)
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow.nodes.map((n) => ({ ...n, type: 'step', selected: n.id === openNode })),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow()

  // Short feedback message (copy, paste) shown over the graph for a few seconds.
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Locked graph: nodes can't be moved, linked or deleted, but can still be clicked to open their settings.
  const [locked, setLocked] = useState(false)
  // Live run feedback from the engine (/api/activity): node id -> running | done | stopped | error | waiting, and
  // edge id -> its target node while data travels on it. Only for display: not saved, not part of undo.
  const [live, setLive] = useState({ nodes: {}, edges: {} })
  useEffect(() => {
    const timers = []
    // Finished states stay visible a moment, unless the node started again meanwhile.
    const fade = (node, state, ms) => timers.push(setTimeout(() => setLive((l) => {
      if (l.nodes[node] !== state) return l
      const nodes = { ...l.nodes }
      delete nodes[node]
      const edges = Object.fromEntries(Object.entries(l.edges).filter(([, target]) => target !== node))
      return { nodes, edges }
    }), ms))
    const source = new EventSource('/api/activity')
    source.onmessage = (e) => {
      const a = JSON.parse(e.data)
      if (a.workflow !== workflow.id || 'running' in a) return
      if (a.edge) return setLive((l) => ({ ...l, edges: { ...l.edges, [a.edge]: a.target } }))
      setLive((l) => ({ ...l, nodes: { ...l.nodes, [a.node]: a.state } }))
      if (a.state === 'error') notify(`${nodes.find((n) => n.id === a.node)?.data.label ?? 'A node'} failed: ${a.error}`, 'red')
      if (a.state !== 'running' && a.state !== 'waiting') fade(a.node, a.state, a.state === 'error' ? 4000 : 1500)
    }
    return () => {
      source.close()
      timers.forEach(clearTimeout)
    }
  }, [])
  // A widget node shows what its Fire Widget nodes do (the busiest state wins), and a link animates while its
  // Fire Widget node runs. Links have no arrow: they carry no data.
  const busiest = ['running', 'waiting', 'error', 'done', 'stopped']
  const state = (n) => n.data.type !== 'widget' ? live.nodes[n.id]
    : busiest.find((st) => edges.some((e) => isLink(e) && e.source === n.id && live.nodes[e.target] === st))
  const shownNodes = nodes.map((n) => (state(n) ? { ...n, className: `run-${state(n)}` } : n))
  const shownEdges = edges.map((e) => (isLink(e) ? { ...e, markerEnd: undefined, animated: live.nodes[e.target] === 'running', className: 'widget-link' }
    : live.edges[e.id] ? { ...e, animated: true, className: 'run-flow' } : e))

  const [toast, setToast] = useState(null)
  const toastTimer = useRef()
  const notify = (message, color = 'teal') => {
    setToast({ message, color })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // When a pane opens, closes or is resized, the graph area changes size: pan so the graph's center stays put.
  const flowRef = useRef()
  useEffect(() => {
    let last
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (last) {
        const v = getViewport()
        setViewport({ ...v, x: v.x + (width - last.width) / 2, y: v.y + (height - last.height) / 2 })
      }
      last = { width, height }
    })
    observer.observe(flowRef.current)
    return () => observer.disconnect()
  }, [])
  const nodeTypes = useMemo(() => ({
    step: function Step(props) {
      const ref = widgetRef(props, useNodes(), useEdges())
      return <FlowNode {...props} def={defs.find((d) => d.type === props.data.type)} widget={ref && findWidget(widgets, ref)} />
    },
  }), [defs, widgets])

  // The graph's content: only the fields the engine needs (no selection or drag state).
  const graph = {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
  }
  const graphKey = JSON.stringify(graph)

  // Debounced autosave.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...graph }),
      }).then(() => onRename())
    }, 500)
    return () => clearTimeout(timer)
  }, [name, graphKey])

  useEffect(() => {
    for (const w of widgets) knownWidgets[w.id] = w
  }, [widgets])
  // Puts back the widget instances these nodes use that the server has deleted meanwhile.
  const restoreWidgets = async (list) => {
    const ids = new Set(list.filter((n) => n.data.type === 'widget').map((n) => n.data.config.widget))
    const missing = [...ids].filter((id) => knownWidgets[id] && !widgets.some((w) => w.id === id))
    for (const id of missing) {
      await fetch(`/api/widgets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(knownWidgets[id]) })
    }
    if (missing.length) onWidgetChange()
  }

  // Undo/redo: snapshots of the graph content, taken once an edit settles (not while a node is being dragged).
  const history = useRef({ past: [], future: [], current: graph, key: graphKey })
  const [, setHistoryVersion] = useState(0) // re-renders the undo/redo buttons
  const dragging = nodes.some((n) => n.dragging)
  useEffect(() => {
    const h = history.current
    if (dragging || graphKey === h.key) return
    const timer = setTimeout(() => {
      h.past.push(h.current)
      h.future = []
      Object.assign(h, { current: graph, key: graphKey })
      setHistoryVersion((v) => v + 1)
    }, 300)
    return () => clearTimeout(timer)
  }, [graphKey, dragging])
  const travel = (from, to) => {
    const h = history.current
    if (!h[from].length) return
    h[to].push(h.current)
    h.current = h[from].pop()
    h.key = JSON.stringify(h.current)
    setNodes(h.current.nodes)
    setEdges(h.current.edges)
    restoreWidgets(h.current.nodes)
    setHistoryVersion((v) => v + 1)
  }
  const undo = () => travel('past', 'future')
  const redo = () => travel('future', 'past')

  // A Fire Widget node drives one widget: a new link to its diamond input replaces the old one, and clears the
  // node's action if the new widget doesn't have it.
  const onConnect = (c) => {
    if (c.targetHandle !== 'widget') return setEdges((es) => addEdge(c, es))
    setEdges((es) => addEdge(c, es.filter((e) => !(e.target === c.target && e.targetHandle === 'widget'))))
    const actions = types.find((t) => t.type === findWidget(widgets, widgetRef(nodes.find((n) => n.id === c.source), nodes, edges))?.type)?.actions ?? []
    setNodes((ns) => ns.map((n) => (n.id === c.target && !actions.includes(n.data.config.action)
      ? { ...n, data: { ...n.data, config: { ...n.data.config, action: '' } } } : n)))
  }

  // A library item is a node type, or a widget type: that creates a new widget instance (with its own id) and a
  // widget node for it.
  const onDrop = async (e) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const type = types.find((t) => t.type === e.dataTransfer.getData('application/ovrly-widget'))
    const def = defs.find((d) => d.type === (type ? 'widget' : e.dataTransfer.getData('application/ovrly')))
    if (!def) return
    let config = {}
    if (type) {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: type.label, type: type.type, config: {} }),
      })
      config = { widget: (await res.json()).id }
      onWidgetChange()
    }
    setNodes((ns) => ns.concat({ id: crypto.randomUUID(), type: 'step', position, data: { type: def.type, label: def.label, config } }))
  }

  const nodeName = (n) => (n.data.type === 'widget' ? findWidget(widgets, n.data.config.widget)?.name : null) ?? n.data.label
  const copy = (picked) => {
    const ids = picked.map((n) => n.id)
    clipboard = { nodes: picked, edges: edges.filter((ed) => ids.includes(ed.source) && ids.includes(ed.target)) }
    const what = picked.length === 1 ? nodeName(picked[0]) : `${picked.length} nodes`
    notify(`Copied ${what}. Paste with Ctrl+V, here or in another workflow.`)
  }
  // Pasted nodes get new ids and are offset. A widget instance already in this workflow is not pasted again: links
  // from the copied widget node go to the one already here.
  const paste = () => {
    const here = Object.fromEntries(nodes.filter((n) => n.data.type === 'widget').map((n) => [n.data.config.widget, n.id]))
    const fresh = clipboard.nodes.filter((n) => !(n.data.type === 'widget' && here[n.data.config.widget]))
    const skipped = clipboard.nodes.length - fresh.length
    if (!fresh.length) return notify(skipped === 1 ? 'This widget is already in this workflow.' : 'These widgets are already in this workflow.')
    const ids = Object.fromEntries(clipboard.nodes.map((n) => [n.id, fresh.includes(n) ? crypto.randomUUID() : here[n.data.config.widget]]))
    const pasted = fresh.map((n) => ({ ...n, id: ids[n.id], selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 } }))
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pasted))
    restoreWidgets(pasted)
    const links = clipboard.edges.filter((ed) => ids[ed.source] && ids[ed.target])
    setEdges((es) => es.concat(links.map((ed) => ({ ...ed, id: crypto.randomUUID(), source: ids[ed.source], target: ids[ed.target] }))))
    const what = fresh.length === 1 ? nodeName(fresh[0]) : `${fresh.length} nodes`
    notify(`Pasted ${what}${skipped ? `; skipped ${skipped} widget${skipped > 1 ? 's' : ''} already in this workflow` : ''}.`)
  }

  // Copy, paste, undo and redo shortcuts, skipped while typing in a field (which has its own undo).
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, textarea, [contenteditable]')) return
      const key = e.key.toLowerCase()
      const picked = nodes.filter((n) => n.selected)
      if (key === 'c' && picked.length) copy(picked)
      if (key === 'v' && clipboard) paste()
      if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else if (key === 'z') undo()
      if (key === 'z' || key === 'y') e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [nodes, edges, widgets])

  const selected = nodes.find((n) => n.selected)
  // The shell shows the bottom (node settings) pane for the selected node, and remembers it per workflow.
  useEffect(() => {
    onNodeSelect(selected?.id ?? null)
  }, [selected?.id])
  const hasManual = nodes.some((n) => n.data.type === 'manual')
  // One-shot auto layout: moves every node once (a single undo step), then fits the view. Nodes stay movable.
  const arrange = () => {
    const positions = layout(nodes, edges, defs)
    setNodes((ns) => ns.map((n) => ({ ...n, position: positions[n.id] })))
    setTimeout(() => fitView({ ...fitOptions, duration: 300 }))
  }
  const setConfig = (config) =>
    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, config } } : n)))

  return (
    <>
      <AppShell.Main className="editor">
        <Group gap="xs" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
          <Tooltip label="Undo (Ctrl+Z)">
            <ActionIcon size="md" variant="default" disabled={!history.current.past.length} onClick={undo}><IconArrowBackUp size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Shift+Z)">
            <ActionIcon size="md" variant="default" disabled={!history.current.future.length} onClick={redo}><IconArrowForwardUp size={18} /></ActionIcon>
          </Tooltip>
          <TextInput flex={1} size="xs" value={name} onChange={(e) => setName(e.target.value)} />
          <Tooltip label={hasManual ? 'Run manual triggers' : 'Add a Manual trigger to run this workflow by hand'}>
            <ActionIcon size="md" variant="light" color="green" disabled={!hasManual} onClick={() => fetch(`/api/workflows/${workflow.id}/run`, { method: 'POST' })}>
              <IconPlayerPlay size={18} />
            </ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label="Export as JSON">
            <ActionIcon size="md" variant="default" onClick={() => exportWorkflow(workflow.id).then((b) => download(b, name))}><IconDownload size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Delete workflow">
            <ActionIcon size="md" variant="light" color="red" onClick={() => setConfirmDelete(true)}><IconTrash size={18} /></ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label={`${panels.library ? 'Hide' : 'Show'} node library`}>
            <ActionIcon size="md" variant={panels.library ? 'light' : 'default'} onClick={() => onToggle('library')}><IconLayoutSidebarRight size={18} /></ActionIcon>
          </Tooltip>
        </Group>
        <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete workflow?" size="sm">
          <Text size="sm" mb="lg">
            "{name}" will be deleted, with the widgets no other workflow uses. This can't be undone.
          </Text>
          <Group justify="end" gap="xs">
            <Button variant="default" onClick={() => setConfirmDelete(false)} data-autofocus>Cancel</Button>
            <Button color="red" onClick={onDelete}>Delete</Button>
          </Group>
        </Modal>
        {toast && (
          <Notification withCloseButton={false} className="toast" color={toast.color}>{toast.message}</Notification>
        )}
        <ReactFlow
          ref={flowRef}
          nodes={shownNodes}
          edges={shownEdges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={edgeOptions}
          selectNodesOnDrag={false} // moving a node must not open its settings; a click does
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          deleteKeyCode={locked ? null : 'Backspace'}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          colorMode="dark"
          fitView
          fitViewOptions={fitOptions}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#555" gap={20} />
          <Controls position="top-left" fitViewOptions={fitOptions} showInteractive={false}>
            <ControlButton onClick={() => setLocked((l) => !l)} title={locked ? 'Unlock the graph' : 'Lock node positions'}>
              {locked ? <IconLock /> : <IconLockOpen />}
            </ControlButton>
            <ControlButton onClick={arrange} disabled={locked} title={locked ? 'Unlock the graph to arrange it' : 'Arrange nodes (once)'}>
              <IconSitemap style={{ transform: 'rotate(-90deg)' }} />
            </ControlButton>
          </Controls>
        </ReactFlow>
      </AppShell.Main>
      <Config
        node={selected}
        def={defs.find((d) => d.type === selected?.data.type)}
        context={{
          vars: selected ? upstreamKeys(selected.id, { nodes, edges, defs, widgets, types }) : [],
          widget: findWidget(widgets, widgetRef(selected, nodes, edges) ?? ''),
          types,
        }}
        onChange={setConfig}
        onWidgetChange={onWidgetChange}
        onCopy={() => copy([selected])}
      />
    </>
  )
}

export default function Workflow({ id, onChange, ...props }) {
  const [workflow, setWorkflow] = useState(null)
  useEffect(() => {
    fetch(`/api/workflows/${id}`).then((r) => r.json()).then(setWorkflow)
  }, [id])

  const onDelete = async () => {
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    onChange(null)
  }

  if (!workflow) return null
  return (
    <ReactFlowProvider>
      <Editor workflow={workflow} onRename={() => onChange(id)} onDelete={onDelete} {...props} />
    </ReactFlowProvider>
  )
}
