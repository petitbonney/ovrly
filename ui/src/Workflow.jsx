// Workflow editor: ReactFlow graph (center) and selected node settings (bottom), autosaved.
// Nodes are dropped from the library: node types, or widget types (each drop creates a widget instance).
// Ctrl/Cmd+C and Ctrl/Cmd+V copy nodes, also into another workflow; pasted widget nodes share the same instance.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ActionIcon, AppShell, Group, Text, TextInput, Tooltip } from '@mantine/core'
import { IconDownload, IconLayoutBottombar, IconLayoutSidebarRight, IconPlayerPlay, IconTrash } from '@tabler/icons-react'
import Fields from './Fields.jsx'
import WidgetSettings from './Widget.jsx'
import FlowNode, { colors, icons, widgetIcons } from './FlowNode.jsx'
import { ChatTest } from './Chat.jsx'
import { exportWorkflow, download } from './share.js'

const findWidget = (widgets, ref) => widgets.find((w) => w.id === ref || w.name === ref)

// Copied nodes and the edges between them; kept in memory so they can be pasted into another workflow.
let clipboard = null

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
function Config({ node, def, context, onChange, onWidgetChange }) {
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
          : widget && type ? <WidgetSettings key={widget.id} widget={widget} type={type} onChange={onWidgetChange}>{fields}</WidgetSettings>
          : <Text size="sm" c="red">This widget was deleted. Drop a new one from the library.</Text>}
      </div>
    </AppShell.Footer>
  )
}

function Editor({ workflow, defs, widgets, types, onRename, onDelete, onWidgetChange, panels, onToggle, onNodeSelect }) {
  const [name, setName] = useState(workflow.name)
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes.map((n) => ({ ...n, type: 'step' })))
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const { screenToFlowPosition } = useReactFlow()
  const nodeTypes = useMemo(() => ({
    step: (props) => (
      <FlowNode {...props} def={defs.find((d) => d.type === props.data.type)} widget={findWidget(widgets, props.data.config.widget)} />
    ),
  }), [defs, widgets])

  // Debounced autosave; only the fields the engine needs are stored.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
          edges: edges.map(({ id, source, sourceHandle, target }) => ({ id, source, sourceHandle, target })),
        }),
      }).then(() => onRename())
    }, 500)
    return () => clearTimeout(timer)
  }, [name, nodes, edges])

  const onConnect = useCallback((c) => setEdges((es) => addEdge(c, es)), [])

  // A library item is a node type, or a widget type: that creates a new widget instance (the server picks a free
  // name) and a widget node for it, set to the type's first action.
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

  // Copy/paste of the selected nodes, skipped while typing in a field. Pasted nodes get new ids and are offset.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.target.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'c') {
        const picked = nodes.filter((n) => n.selected)
        if (!picked.length) return
        const ids = picked.map((n) => n.id)
        clipboard = { nodes: picked, edges: edges.filter((ed) => ids.includes(ed.source) && ids.includes(ed.target)) }
      }
      if (e.key === 'v' && clipboard) {
        const ids = Object.fromEntries(clipboard.nodes.map((n) => [n.id, crypto.randomUUID()]))
        const pasted = clipboard.nodes.map((n) => ({
          ...n, id: ids[n.id], selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 },
        }))
        setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pasted))
        setEdges((es) => es.concat(clipboard.edges.map((ed) => ({ ...ed, id: crypto.randomUUID(), source: ids[ed.source], target: ids[ed.target] }))))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [nodes, edges])

  const selected = nodes.find((n) => n.selected)
  const hasManual = nodes.some((n) => n.data.type === 'manual')
  // Tells the shell whether to show the bottom (node config) pane.
  const hasNode = !!selected
  useEffect(() => {
    onNodeSelect(hasNode)
    return () => onNodeSelect(false)
  }, [hasNode])
  const setConfig = (config) =>
    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, config } } : n)))

  return (
    <>
      <AppShell.Main className="editor">
        <Group gap="xs" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
          <TextInput flex={1} size="xs" value={name} onChange={(e) => setName(e.target.value)} />
          <Tooltip label={hasManual ? 'Run manual triggers' : 'Add a Manual trigger to run this workflow by hand'}>
            <ActionIcon size="md" variant="light" color="green" disabled={!hasManual} onClick={() => fetch(`/api/workflows/${workflow.id}/run`, { method: 'POST' })}>
              <IconPlayerPlay size={18} />
            </ActionIcon>
          </Tooltip>
          <ChatTest />
          <Tooltip label={`${panels.config ? 'Hide' : 'Show'} node settings`}>
            <ActionIcon size="md" variant={panels.config ? 'light' : 'default'} onClick={() => onToggle('config')}><IconLayoutBottombar size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label={`${panels.library ? 'Hide' : 'Show'} node library`}>
            <ActionIcon size="md" variant={panels.library ? 'light' : 'default'} onClick={() => onToggle('library')}><IconLayoutSidebarRight size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Export as JSON">
            <ActionIcon size="md" variant="default" onClick={() => exportWorkflow(workflow.id).then((b) => download(b, name))}><IconDownload size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Delete workflow">
            <ActionIcon size="md" variant="light" color="red" onClick={onDelete}><IconTrash size={18} /></ActionIcon>
          </Tooltip>
        </Group>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={edgeOptions}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          colorMode="dark"
          fitView
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
