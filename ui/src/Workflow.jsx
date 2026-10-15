// Workflow editor: ReactFlow graph (center) and selected node config (bottom), autosaved.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MarkerType,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ActionIcon, AppShell, Checkbox, Group, NumberInput, Stack, TextInput, Tooltip } from '@mantine/core'
import { IconDownload, IconLayoutBottombar, IconLayoutSidebarRight, IconTrash } from '@tabler/icons-react'
import Heading from './Heading.jsx'
import FlowNode from './FlowNode.jsx'
import { exportItem, download } from './share.js'

// Form generated from a config's defaults; the input kind follows each default value's type.
export function Fields({ defaults, values, onChange }) {
  const keys = Object.keys(defaults)
  if (keys.length === 0) return 'No settings'
  return (
    <Stack gap="xs" mb="md">
      {keys.map((key) => {
        const fallback = defaults[key]
        const value = values[key] ?? fallback
        const set = (v) => onChange({ ...values, [key]: v })
        if (typeof fallback === 'boolean') return <Checkbox key={key} label={key} checked={value} onChange={(e) => set(e.target.checked)} />
        if (typeof fallback === 'number') return <NumberInput key={key} label={key} w={240} size="xs" value={value} onChange={(v) => set(Number(v))} />
        return <TextInput key={key} label={key} w={240} size="xs" value={value} onChange={(e) => set(e.target.value)} />
      })}
    </Stack>
  )
}

// Every node is drawn by FlowNode ("step"); edges get an arrow like n8n.
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '#9a9a9a' } }

function Config({ node, def, onChange }) {
  if (!node || !def) return null
  return (
    <AppShell.Footer p="sm" style={{ overflow: 'auto' }}>
      <Heading title={def.label} />
      <Fields defaults={def.config} values={node.data.config} onChange={onChange} />
    </AppShell.Footer>
  )
}

function Editor({ workflow, defs, onRename, onDelete, panels, onToggle, onNodeSelect }) {
  const [name, setName] = useState(workflow.name)
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes.map((n) => ({ ...n, type: 'step' })))
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const { screenToFlowPosition } = useReactFlow()
  const nodeTypes = useMemo(() => ({
    step: (props) => <FlowNode {...props} def={defs.find((d) => d.type === props.data.type)} />,
  }), [defs])

  // Debounced autosave; only the fields the engine needs are stored.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
          edges: edges.map(({ id, source, target }) => ({ id, source, target })),
        }),
      }).then(() => onRename())
    }, 500)
    return () => clearTimeout(timer)
  }, [name, nodes, edges])

  const onConnect = useCallback((c) => setEdges((es) => addEdge(c, es)), [])

  const onDrop = (e) => {
    e.preventDefault()
    const def = defs.find((d) => d.type === e.dataTransfer.getData('application/ovrly'))
    if (!def) return
    setNodes((ns) => ns.concat({
      id: crypto.randomUUID(),
      type: 'step',
      position: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      data: { type: def.type, label: def.label, config: {} },
    }))
  }

  const selected = nodes.find((n) => n.selected)
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
          <Tooltip label={`${panels.config ? 'Hide' : 'Show'} node settings`}>
            <ActionIcon size="md" variant={panels.config ? 'light' : 'default'} onClick={() => onToggle('config')}><IconLayoutBottombar size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label={`${panels.library ? 'Hide' : 'Show'} node library`}>
            <ActionIcon size="md" variant={panels.library ? 'light' : 'default'} onClick={() => onToggle('library')}><IconLayoutSidebarRight size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Export as JSON">
            <ActionIcon size="md" variant="default" onClick={() => exportItem('workflows', workflow.id).then((b) => download(b, name))}><IconDownload size={18} /></ActionIcon>
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
      <Config node={selected} def={defs.find((d) => d.type === selected?.data.type)} onChange={setConfig} />
    </>
  )
}

export default function Workflow({ id, defs, onChange, ...panelProps }) {
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
      <Editor workflow={workflow} defs={defs} onRename={() => onChange(id)} onDelete={onDelete} {...panelProps} />
    </ReactFlowProvider>
  )
}
