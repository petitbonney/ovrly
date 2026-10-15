// Workflow editor: ReactFlow graph (center) and selected node config (bottom), autosaved.
import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AppShell, Button, Checkbox, Group, NumberInput, Stack, TextInput } from '@mantine/core'
import Heading from './Heading.jsx'
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

// Left-to-right graph: inputs on the left side of a node, outputs on the right. Not stored, set on load and drop.
const sides = { targetPosition: 'left', sourcePosition: 'right' }

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
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes.map((n) => ({ ...n, ...sides })))
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const { screenToFlowPosition } = useReactFlow()

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
      ...sides,
      // Triggers have no input handle.
      type: def.category === 'trigger' ? 'input' : 'default',
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
          <Button size="xs" variant={panels.config ? 'light' : 'default'} onClick={() => onToggle('config')}>Config</Button>
          <Button size="xs" variant={panels.library ? 'light' : 'default'} onClick={() => onToggle('library')}>Library</Button>
          <Button size="xs" variant="default" onClick={() => exportItem('workflows', workflow.id).then((b) => download(b, name))}>Export</Button>
          <Button size="xs" variant="light" color="red" onClick={onDelete}>Delete workflow</Button>
        </Group>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          colorMode="dark"
          fitView
        >
          <Background />
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
