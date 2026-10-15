// Workflow editor: ReactFlow graph (center) and selected node config (bottom), autosaved.
import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  useNodesState, useEdgesState, addEdge, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Form generated from a config's defaults; the input kind follows each default value's type.
export function Fields({ defaults, values, onChange }) {
  const keys = Object.keys(defaults)
  if (keys.length === 0) return 'No settings'
  return keys.map((key) => {
    const fallback = defaults[key]
    const value = values[key] ?? fallback
    const set = (v) => onChange({ ...values, [key]: v })
    return (
      <label key={key} className="field">
        {key}
        {typeof fallback === 'boolean' ? (
          <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
        ) : (
          <input
            type={typeof fallback === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => set(typeof fallback === 'number' ? Number(e.target.value) : e.target.value)}
          />
        )}
      </label>
    )
  })
}

function Config({ node, def, onChange }) {
  if (!node || !def) return <section className="bottom">Select a node</section>
  return (
    <section className="bottom">
      <h2>{def.label}</h2>
      <Fields defaults={def.config} values={node.data.config} onChange={onChange} />
    </section>
  )
}

function Editor({ workflow, defs, onRename, onDelete }) {
  const [name, setName] = useState(workflow.name)
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes)
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
      // Triggers have no input handle.
      type: def.category === 'trigger' ? 'input' : 'default',
      position: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      data: { type: def.type, label: def.label, config: {} },
    }))
  }

  const selected = nodes.find((n) => n.selected)
  const setConfig = (config) =>
    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, config } } : n)))

  return (
    <>
      <main className="center flow">
        <div className="toolbar">
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={onDelete}>Delete workflow</button>
        </div>
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
      </main>
      <Config node={selected} def={defs.find((d) => d.type === selected?.data.type)} onChange={setConfig} />
    </>
  )
}

export default function Workflow({ id, defs, onChange }) {
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
      <Editor workflow={workflow} defs={defs} onRename={() => onChange(id)} onDelete={onDelete} />
    </ReactFlowProvider>
  )
}
