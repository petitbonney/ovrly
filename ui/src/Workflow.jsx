// Workflow editor: ReactFlow graph (center) and selected node settings (bottom), autosaved.
// Nodes are dropped from the library: node types, or widget types (each drop creates a widget instance).
// Ctrl/Cmd+C and Ctrl/Cmd+V copy nodes, also into another workflow; pasted widget nodes share the same instance,
// which can be used once per workflow. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) undo and redo graph edits.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ActionIcon, AppShell, Divider, Group, Notification, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconArrowBackUp, IconArrowForwardUp, IconDownload, IconLayoutSidebarRight, IconPlayerPlay, IconTrash,
} from '@tabler/icons-react'
import Fields from './Fields.jsx'
import WidgetSettings from './Widget.jsx'
import FlowNode, { colors, icons, widgetIcons } from './FlowNode.jsx'
import { ChatTest } from './Chat.jsx'
import { exportWorkflow, download } from './share.js'

const findWidget = (widgets, ref) => widgets.find((w) => w.id === ref || w.name === ref)

// Copied nodes and the edges between them; kept in memory so they can be pasted into another workflow.
let clipboard = null
// Widget id -> last known widget instance. The server deletes an instance with its last node; undo or paste
// puts it back from here.
const knownWidgets = {}

// Data keys a node can use as {key}: what every node upstream of it adds (a manual trigger adds its JSON's keys,
// a widget node what its widget type outputs).
function upstreamKeys(id, { nodes, edges, defs, widgets, types }) {
  const keys = new Set()
  const seen = new Set()
  const queue = [id]
  while (queue.length) {
    const target = queue.pop()
    for (const e of edges.filter((e) => e.target === target)) {
      if (seen.has(e.source)) continue
      seen.add(e.source)
      queue.push(e.source)
      const node = nodes.find((n) => n.id === e.source)
      const def = defs.find((d) => d.type === node?.data.type)
      const type = def?.type === 'widget-update' && types.find((t) => t.type === findWidget(widgets, node.data.config.widget)?.type)
      for (const k of [...(def?.adds ?? []), ...(type?.adds ?? [])]) keys.add(k)
      if (def?.type === 'manual') {
        try { Object.keys(JSON.parse(node.data.config.data ?? def.config.data)).forEach((k) => keys.add(k)) } catch {}
      }
    }
  }
  return [...keys]
}

// Every node is drawn by FlowNode ("step"); edges get an arrow like n8n.
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '#9a9a9a' } }

// Settings of the selected node: title, description, then a form built from the node type's fields.
// A widget node also shows its widget instance's settings and preview.
function Config({ node, def, context, onChange, onWidgetChange, onCopy }) {
  if (!node || !def) return null
  const widget = def.type === 'widget-update' && findWidget(context.widgets, node.data.config.widget)
  const type = widget && context.types.find((t) => t.type === widget.type)
  const Icon = (widget ? widgetIcons[widget.type] : icons[def.type]) ?? icons.log
  const fields = <Fields defaults={def.config} values={node.data.config} fields={def.fields} context={context} onChange={onChange} />
  return (
    <AppShell.Footer>
      <div className="pane">
        <Group gap="xs" mb={4}>
          <Icon size={20} color={colors[def.category]} />
          <Text fw={600}>{widget ? widget.name : def.label}</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">{def.description}</Text>
        {def.type !== 'widget-update' ? fields
          : widget && type ? <WidgetSettings key={widget.id} widget={widget} type={type} onChange={onWidgetChange} onCopy={onCopy}>{fields}</WidgetSettings>
          : <Text size="sm" c="red">This widget was deleted. Drop a new one from the library.</Text>}
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
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow()

  // Short feedback message (copy, paste) shown over the graph for a few seconds.
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()
  const notify = (message) => {
    setToast(message)
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
    step: (props) => (
      <FlowNode {...props} def={defs.find((d) => d.type === props.data.type)} widget={findWidget(widgets, props.data.config.widget)} />
    ),
  }), [defs, widgets])

  // The graph's content: only the fields the engine needs (no selection or drag state).
  const graph = {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, sourceHandle, target }) => ({ id, source, sourceHandle, target })),
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
    const ids = new Set(list.filter((n) => n.data.type === 'widget-update').map((n) => n.data.config.widget))
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

  const onConnect = useCallback((c) => setEdges((es) => addEdge(c, es)), [])

  // A library item is a node type, or a widget type: that creates a new widget instance (with its own id) and a
  // widget node for it, set to the type's first action.
  const onDrop = async (e) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const type = types.find((t) => t.type === e.dataTransfer.getData('application/ovrly-widget'))
    const def = defs.find((d) => d.type === (type ? 'widget-update' : e.dataTransfer.getData('application/ovrly')))
    if (!def) return
    let config = {}
    if (type) {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: type.label, type: type.type, config: {} }),
      })
      config = { widget: (await res.json()).id, action: type.actions[0], value: '' }
      onWidgetChange()
    }
    setNodes((ns) => ns.concat({ id: crypto.randomUUID(), type: 'step', position, data: { type: def.type, label: def.label, config } }))
  }

  const nodeName = (n) => (n.data.type === 'widget-update' ? findWidget(widgets, n.data.config.widget)?.name : null) ?? n.data.label
  const copy = (picked) => {
    const ids = picked.map((n) => n.id)
    clipboard = { nodes: picked, edges: edges.filter((ed) => ids.includes(ed.source) && ids.includes(ed.target)) }
    const what = picked.length === 1 ? nodeName(picked[0]) : `${picked.length} nodes`
    notify(`Copied ${what}. Paste with Ctrl+V, here or in another workflow.`)
  }
  // Pasted nodes get new ids and are offset. A widget instance already used in this workflow is not pasted again.
  const paste = () => {
    const here = nodes.filter((n) => n.data.type === 'widget-update').map((n) => n.data.config.widget)
    const fresh = clipboard.nodes.filter((n) => !(n.data.type === 'widget-update' && here.includes(n.data.config.widget)))
    const skipped = clipboard.nodes.length - fresh.length
    if (!fresh.length) return notify(skipped === 1 ? 'This widget is already in this workflow.' : 'These widgets are already in this workflow.')
    const ids = Object.fromEntries(fresh.map((n) => [n.id, crypto.randomUUID()]))
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
          <ChatTest />
          <Divider orientation="vertical" />
          <Tooltip label="Export as JSON">
            <ActionIcon size="md" variant="default" onClick={() => exportWorkflow(workflow.id).then((b) => download(b, name))}><IconDownload size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Delete workflow">
            <ActionIcon size="md" variant="light" color="red" onClick={onDelete}><IconTrash size={18} /></ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label={`${panels.library ? 'Hide' : 'Show'} node library`}>
            <ActionIcon size="md" variant={panels.library ? 'light' : 'default'} onClick={() => onToggle('library')}><IconLayoutSidebarRight size={18} /></ActionIcon>
          </Tooltip>
        </Group>
        {toast && (
          <Notification withCloseButton={false} className="toast" color="teal">{toast}</Notification>
        )}
        <ReactFlow
          ref={flowRef}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={edgeOptions}
          selectNodesOnDrag={false} // moving a node must not open its settings; a click does
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          colorMode="dark"
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.3 }} // a small graph is not blown up to fill the canvas
        >
          <Background color="#555" gap={20} />
          <Controls />
        </ReactFlow>
      </AppShell.Main>
      <Config
        node={selected}
        def={defs.find((d) => d.type === selected?.data.type)}
        context={{ vars: selected ? upstreamKeys(selected.id, { nodes, edges, defs, widgets, types }) : [], widgets, types }}
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
