// Workflow editor: ReactFlow graph (center) and selected node settings (bottom), autosaved.
// Nodes are dropped from the library: node types, or widget types (each drop creates a widget instance and its widget
// node). A widget node runs its widget's main action; a Widget Callback node runs any action on a widget node of the
// same workflow, picked in its settings. Ctrl/Cmd+C and Ctrl/Cmd+V copy nodes, also into another workflow; pasted
// widget nodes share the same instance, which has one widget node per workflow. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) undo and redo graph edits.
// Canvas rule: the view never moves on its own, except to keep the selected node in sight. Shift+1 fits the graph,
// Escape closes the node settings.
import { useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, ControlButton, MarkerType,
  useNodesState, useEdgesState, useNodesInitialized, addEdge, useReactFlow, useStore,
} from '@xyflow/react'
import { animate } from 'animejs'
import '@xyflow/react/dist/style.css'
import { ActionIcon, AppShell, Button, Divider, Group, Modal, Notification, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconArrowBackUp, IconArrowForwardUp, IconDownload, IconLayoutSidebarRight, IconLock, IconLockOpen, IconMaximize, IconMinus,
  IconPlayerPlay, IconPlayerStop, IconPlus, IconSitemap,
  IconTrash,
} from '@tabler/icons-react'
import Fields from './Fields.jsx'
import WidgetSettings from './Widget.jsx'
import QueueLine from './QueueLine.jsx'
import Merge from './Merge.jsx'
import FlowNode, { colors, icons, widgetIcons, outputsOf } from './FlowNode.jsx'
import layout from './layout.js'
import { exportWorkflow, download } from './share.js'
import { get, json } from './api.js'

const findWidget = (widgets, ref) => widgets.find((w) => w.id === ref || w.name === ref)
// Copied nodes and the edges between them; kept in memory so they can be pasted into another workflow.
let clipboard = null
// A workflow's last view (pan and zoom), kept by this browser: it reopens where it was left, even after a refresh.
const savedView = (id) => {
  try { return JSON.parse(localStorage.getItem(`ovrly-view-${id}`)) } catch {}
}
const saveView = (id, view) => {
  try { localStorage.setItem(`ovrly-view-${id}`, JSON.stringify(view)) } catch {}
}
// Widget id -> last known widget instance. The server deletes an instance with its last node; undo or paste
// puts it back from here.
const knownWidgets = {}

// Data keys a node can use as {{key}}: what every node upstream of it adds (a manual trigger adds its JSON's keys,
// a widget or Widget Callback node what its widget type outputs).
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
      const widget = node.data.config.widget && findWidget(widgets, node.data.config.widget)
      const adds = types.find((t) => t.type === widget?.type)?.adds ?? []
      for (const k of [...(def?.adds ?? []), ...adds]) keys.add(k)
      for (const item of node.data.config[def?.addsFrom] ?? def?.config[def?.addsFrom] ?? []) if (item.name) keys.add(item.name)
      if (def?.type === 'manual') {
        try { Object.keys(JSON.parse(node.data.config.data ?? def.config.data)).forEach((k) => keys.add(k)) } catch {}
      }
    }
  }
  return [...keys]
}

// A link is allowed if it doesn't close a loop: the target must not already lead back to the source (or be the
// source itself). Only widget nodes link into a Merge Widgets node.
function isValidConnection(c, edges, nodes) {
  const type = (id) => nodes.find((n) => n.id === id)?.data.type
  if (type(c.target) === 'merge' && type(c.source) !== 'widget') return false
  const seen = new Set()
  const queue = [c.target]
  while (queue.length) {
    const id = queue.pop()
    if (id === c.source) return false
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of edges) if (e.source === id) queue.push(e.target)
  }
  return true
}
// Every node is drawn by FlowNode ("step"), defined once so nodes aren't rebuilt (and measured again) on each render;
// edges get an arrow like n8n.
const nodeTypes = { step: FlowNode }
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '#9a9a9a' } }
// Fitting the graph (on open and with the fit view button) never zooms past 100%, so a small graph isn't blown up.
const MIN_ZOOM = 0.25
const fitOptions = { maxZoom: 1, padding: 0.3 }
// Nodes snap to the background's dots. A node box is 90px; its caption (two lines) hangs below it.
const GRID = 20
const NODE = 90
const CAPTION = 50
const snap = ({ x, y }) => ({ x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID })
// Box around nodes, from their positions and measured sizes.
function boundsOf(list) {
  const x = Math.min(...list.map((n) => n.position.x))
  const y = Math.min(...list.map((n) => n.position.y))
  const x2 = Math.max(...list.map((n) => n.position.x + (n.measured?.width ?? NODE)))
  const y2 = Math.max(...list.map((n) => n.position.y + (n.measured?.height ?? NODE)))
  return { x, y, width: x2 - x, height: y2 - y }
}

// Settings of the selected node: title, description, then a form built from the node type's fields.
// A widget node shows its widget instance's settings and preview, with the main action's value; a Widget Callback node
// picks a widget node of this workflow (context.instances), then the action to run on it. context.widget is the
// widget the node points to. A Queue node also shows who waits in its line. A Merge Widgets node shows its canvas, with
// the widgets linked into it (context.inputs).
function Config({ workflow, node, def, context, onChange, onWidgetChange, onCopy }) {
  if (!node || !def) return null
  const isWidget = def.type === 'widget'
  const isMerge = def.type === 'merge'
  const { widget } = context
  const type = widget && context.types.find((t) => t.type === widget.type)
  const Icon = (isWidget ? widgetIcons[widget?.type] : icons[def.type]) ?? icons.log
  const fields = <Fields defaults={def.config} values={node.data.config} fields={def.fields} context={context} onChange={onChange} />
  return (
    <AppShell.Footer>
      <div className={(isWidget && type) || isMerge ? 'pane split' : 'pane'}>
        <Group gap="xs" mb={4}>
          <Icon size={20} color={colors[def.category]} />
          <Text fw={600}>{isWidget ? widget?.name ?? 'Missing widget' : def.label}</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">{def.description}</Text>
        {def.streamer && <Text size="xs" c="orange" mb="sm">Needs Twitch in Streamer mode, signed in (Integration → Twitch).</Text>}
        {isWidget ? (
          type ? <WidgetSettings key={widget.id} widget={widget} type={type} value={type.inputs?.[type.main] && fields} testValue={node.data.config.value} onChange={onWidgetChange} onCopy={onCopy} />
            : <Text size="sm" c="red">This widget was deleted. Drop a new one from the library.</Text>
        ) : isMerge ? (
          <Merge workflow={workflow} node={node.id} config={{ ...def.config, ...node.data.config }} widgets={context.inputs} types={context.types} onChange={onChange} />
        ) : fields}
        {def.queue && <QueueLine workflow={workflow} node={node.id} />}
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
  const { screenToFlowPosition, getNodes, getViewport, setViewport, fitView, zoomIn, zoomOut } = useReactFlow()
  // A node's type, from the library's node types.
  const defOf = (n) => defs.find((d) => d.type === n?.data.type)

  // Short feedback message (copy, paste, a node failing) shown over the graph for a few seconds.
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()
  const notify = (message, color = 'teal') => {
    setToast({ message, color })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Locked graph: nodes can't be moved, linked or deleted, but can still be clicked to open their settings.
  const [locked, setLocked] = useState(false)
  // Live run feedback from the engine (/api/activity): node id -> running | done | stopped | error | waiting, and
  // edge id -> its target node while data travels on it. Only for display: not saved, not part of undo.
  const [live, setLive] = useState({ nodes: {}, edges: {} })
  // Firings of this workflow in progress, for the Cancel button.
  const [firings, setFirings] = useState(0)
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
      if (a.workflow !== workflow.id) return
      if ('running' in a) return setFirings(a.running)
      if (a.edge) return setLive((l) => ({ ...l, edges: { ...l.edges, [a.edge]: a.target } }))
      setLive((l) => ({ ...l, nodes: { ...l.nodes, [a.node]: a.state } }))
      if (a.state === 'error') notify(`${nodeName(nodes.find((n) => n.id === a.node) ?? { data: { label: 'A node' } })} failed: ${a.error}`, 'red')
      if (a.state !== 'running' && a.state !== 'waiting') fade(a.node, a.state, a.state === 'error' ? 4000 : 1500)
    }
    return () => {
      source.close()
      timers.forEach(clearTimeout)
    }
  }, [])
  // A link being pulled snaps to the node under the pointer, anywhere on it: to its input when pulled from an output,
  // to its nearest output when pulled from an input. p is in flow coordinates.
  const linkAt = (c, p) => {
    const node = nodes.find((n) => n.id !== c.fromNode.id && p.x >= n.position.x && p.x <= n.position.x + (n.measured?.width ?? 0)
      && p.y >= n.position.y && p.y <= n.position.y + (n.measured?.height ?? 0))
    if (!node) return null
    let link
    if (c.fromHandle.type === 'source') {
      if (defOf(node)?.category === 'trigger') return null
      link = { source: c.fromNode.id, sourceHandle: c.fromHandle.id ?? null, target: node.id }
    } else {
      const outs = outputsOf(defOf(node), node.data.config)
      const y = (i) => node.position.y + ((i + 1) * node.measured.height) / (outs.length + 1) // as placed by FlowNode
      const i = outs.reduce((best, o, i) => (Math.abs(y(i) - p.y) < Math.abs(y(best) - p.y) ? i : best), 0)
      link = { source: node.id, sourceHandle: outs[i]?.id ?? null, target: c.fromNode.id }
    }
    const exists = edges.some((e) => e.source === link.source && (e.sourceHandle ?? null) === link.sourceHandle && e.target === link.target)
    return !exists && isValidConnection(link, edges, nodes) ? { ...link, targetHandle: null } : null // the input handle is picked on display
  }
  const onConnectEnd = (event, c) => {
    const { clientX, clientY } = event.changedTouches?.[0] ?? event
    const link = linkAt(c, screenToFlowPosition({ x: clientX, y: clientY }))
    if (link) setEdges((es) => addEdge(link, es))
  }
  // While pulling, the link it would make is drawn as a real one (in the input slot it would take), in place of the
  // pulled line. The connection's pointer is in screen pixels within the canvas. Selected as a string so this
  // re-renders only when the previewed link changes.
  const preview = JSON.parse(useStore(({ connection: c, transform: [tx, ty, zoom] }) =>
    JSON.stringify(c.inProgress && linkAt(c, { x: (c.pointer.x - tx) / zoom, y: (c.pointer.y - ty) / zoom }))))
  const allEdges = preview ? [...edges, { ...preview, id: 'preview', selectable: false, focusable: false }] : edges

  // Each link into a node gets its own input handle, in the order of its source's height so links don't cross.
  const inputOf = {}
  const incoming = {}
  for (const e of allEdges) (incoming[e.target] ??= []).push(e)
  for (const list of Object.values(incoming)) {
    const y = (e) => nodes.find((n) => n.id === e.source)?.position.y ?? 0
    list.sort((a, b) => y(a) - y(b)).forEach((e, i) => (inputOf[e.id] = `in${i}`))
  }
  const shownNodes = nodes.map((n) => {
    const widget = findWidget(widgets, n.data.config.widget)
    const context = { workflowId: workflow.id, def: defOf(n), widget, widgetType: types.find((t) => t.type === widget?.type) }
    const shown = { ...n, data: { ...n.data, ...context, inputs: incoming[n.id]?.length } }
    return live.nodes[n.id] ? { ...shown, className: `run-${live.nodes[n.id]}` } : shown
  })
  const shownEdges = allEdges.map((e) => ({ ...e, targetHandle: inputOf[e.id] })).map((e) => (live.edges[e.id] ? { ...e, animated: true, className: 'run-flow', markerEnd: { ...edgeOptions.markerEnd, color: '#4dabf7' } } : e))

  // Opening: the workflow's last view if it shows a node, or else the whole graph fitted. Waits until every node is
  // measured (a fit only counts measured nodes); the graph stays hidden until then.
  const flowRef = useRef()
  const initialized = useNodesInitialized()
  const [ready, setReady] = useState(!workflow.nodes.length)
  useEffect(() => {
    if (ready || !initialized) return
    const view = savedView(workflow.id)
    const { clientWidth: w, clientHeight: h } = flowRef.current
    const shows = view && getNodes().some((n) => {
      const x = n.position.x * view.zoom + view.x
      const y = n.position.y * view.zoom + view.y
      return x < w && y < h && x + n.measured.width * view.zoom > 0 && y + n.measured.height * view.zoom > 0
    })
    const opening = shows ? setViewport(view) : fitView(fitOptions)
    opening.then(() => setReady(true))
  }, [initialized])

  // A pane opening, closing or resized changes the canvas size, keeping its top-left corner: nothing moves. Once the
  // size settles, the selected node slides into sight (the least needed) if it ended up under a pane or past an edge.
  useEffect(() => {
    const reveal = () => {
      const node = getNodes().find((n) => n.selected)
      if (!node?.measured) return
      const { x, y, zoom } = getViewport()
      const { clientWidth: w, clientHeight: h } = flowRef.current
      const margin = 40
      const shift = (start, size, room) => (start < margin ? margin - start : Math.min(0, room - margin - start - size))
      const dx = shift(node.position.x * zoom + x, node.measured.width * zoom, w)
      const dy = shift(node.position.y * zoom + y, (node.measured.height + CAPTION) * zoom, h)
      if (dx || dy) setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 250 })
    }
    let first = true
    let timer
    const observer = new ResizeObserver(() => {
      if (first) return (first = false) // the initial size: the opening view handles it
      clearTimeout(timer)
      timer = setTimeout(reveal, 50)
    })
    observer.observe(flowRef.current)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  // The graph's content: only the fields the engine needs (no selection or drag state).
  const graph = {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
  }
  const graphKey = JSON.stringify(graph)

  // Debounced autosave.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/workflows/${workflow.id}`, json('PUT', { name, ...graph })).then(() => onRename())
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
      await fetch(`/api/widgets/${id}`, json('PUT', knownWidgets[id]))
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

  // A library item is a node type, or a widget type: that creates a new widget instance (with its own id) and a
  // widget node for it.
  // Where a double-clicked library item goes: the canvas center when empty; a trigger goes above the top-right trigger,
  // or left of the leftmost node when there is none; anything else goes right of the top-right node.
  const spawnPosition = (def) => {
    const topRight = (list) => list.reduce((a, b) => (b.position.x > a.position.x || (b.position.x === a.position.x && b.position.y < a.position.y) ? b : a))
    const triggers = nodes.filter((n) => defOf(n)?.category === 'trigger')
    let p
    if (!nodes.length) {
      const r = flowRef.current.getBoundingClientRect()
      const c = screenToFlowPosition({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
      p = { x: c.x - NODE / 2, y: c.y - NODE / 2 }
    } else if (def.category === 'trigger' && triggers.length) {
      const t = topRight(triggers).position
      p = { x: t.x, y: t.y - NODE - CAPTION }
    } else if (def.category === 'trigger') {
      const l = nodes.reduce((a, b) => (b.position.x < a.position.x ? b : a)).position
      p = { x: l.x - NODE - GRID * 3, y: l.y }
    } else {
      const t = topRight(nodes)
      p = { x: t.position.x + (t.measured?.width ?? NODE) + GRID * 3, y: t.position.y }
    }
    return snap(p)
  }
  const addItem = async (widgetType, nodeType, position) => {
    const type = types.find((t) => t.type === widgetType)
    const def = defs.find((d) => d.type === (type ? 'widget' : nodeType))
    if (!def) return
    const spawned = !position // double-clicked, not dropped
    position ??= spawnPosition(def)
    let config = {}
    if (type) {
      // Signed in to Twitch (Streamer mode): a widget with a Twitch mode (Poll, Bets) starts in it.
      const twitch = type.fields?.mode?.options?.find((o) => o.streamer)
      const mode = twitch && (await get('/api/twitch')).streamer ? { mode: twitch.value } : {}
      const res = await fetch('/api/widgets', json('POST', { name: type.label, type: type.type, config: mode }))
      config = { widget: (await res.json()).id }
      onWidgetChange()
    }
    setNodes((ns) => ns.concat({ id: crypto.randomUUID(), type: 'step', position, data: { type: def.type, label: def.label, config } }))
    if (spawned) showBox({ ...position, width: NODE, height: NODE + CAPTION })
  }
  // Pans, keeping the zoom, until the box is inside the visible canvas.
  const showBox = (box) => {
    const r = flowRef.current.getBoundingClientRect()
    const tl = screenToFlowPosition({ x: r.left, y: r.top })
    const br = screenToFlowPosition({ x: r.right, y: r.bottom })
    const margin = GRID
    const shift = (lo, hi, from, to) => (lo < from ? lo - from - margin : hi > to ? hi - to + margin : 0)
    const dx = shift(box.x, box.x + box.width, tl.x, br.x)
    const dy = shift(box.y, box.y + box.height, tl.y, br.y)
    if (!dx && !dy) return
    const { x, y, zoom } = getViewport()
    setViewport({ x: x - dx * zoom, y: y - dy * zoom, zoom }, { duration: 300 })
  }

  const onDrop = (e) => {
    e.preventDefault()
    const cursor = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const position = snap({ x: cursor.x - NODE / 2, y: cursor.y - NODE / 2 }) // centered on the cursor
    addItem(e.dataTransfer.getData('application/ovrly-widget'), e.dataTransfer.getData('application/ovrly'), position)
  }
  // Double-clicking a library item adds it next to the existing nodes.
  const addRef = useRef()
  addRef.current = addItem
  useEffect(() => {
    const onAdd = (e) => addRef.current(e.detail.widget, e.detail.node)
    window.addEventListener('ovrly-add', onAdd)
    return () => window.removeEventListener('ovrly-add', onAdd)
  }, [])

  const nodeName = (n) => (n.data.type === 'widget' ? findWidget(widgets, n.data.config.widget)?.name : defOf(n)?.label) ?? n.data.label
  const copy = (picked) => {
    const ids = picked.map((n) => n.id)
    clipboard = { nodes: picked, edges: edges.filter((ed) => ids.includes(ed.source) && ids.includes(ed.target)) }
    const what = picked.length === 1 ? nodeName(picked[0]) : `${picked.length} nodes`
    notify(`Copied ${what}. Paste with Ctrl+V, here or in another workflow.`)
  }
  // Pasted nodes get new ids and keep their layout, centered on the pointer (or the canvas when the pointer is
  // elsewhere). A widget instance already in this workflow is not pasted again: links from the copied widget node go
  // to the one already here.
  const pointer = useRef(null)
  const paste = () => {
    const here = Object.fromEntries(nodes.filter((n) => n.data.type === 'widget').map((n) => [n.data.config.widget, n.id]))
    const fresh = clipboard.nodes.filter((n) => !(n.data.type === 'widget' && here[n.data.config.widget]))
    const skipped = clipboard.nodes.length - fresh.length
    if (!fresh.length) return notify(skipped === 1 ? 'This widget is already in this workflow.' : 'These widgets are already in this workflow.')
    const ids = Object.fromEntries(clipboard.nodes.map((n) => [n.id, fresh.includes(n) ? crypto.randomUUID() : here[n.data.config.widget]]))
    const r = flowRef.current.getBoundingClientRect()
    const at = screenToFlowPosition(pointer.current ?? { x: r.x + r.width / 2, y: r.y + r.height / 2 })
    const b = boundsOf(fresh)
    const d = snap({ x: at.x - b.x - b.width / 2, y: at.y - b.y - b.height / 2 })
    const pasted = fresh.map((n) => ({ ...n, id: ids[n.id], selected: true, position: { x: n.position.x + d.x, y: n.position.y + d.y } }))
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pasted))
    restoreWidgets(pasted)
    const links = clipboard.edges.filter((ed) => ids[ed.source] && ids[ed.target])
    setEdges((es) => es.concat(links.map((ed) => ({ ...ed, id: crypto.randomUUID(), source: ids[ed.source], target: ids[ed.target] }))))
    const what = fresh.length === 1 ? nodeName(fresh[0]) : `${fresh.length} nodes`
    notify(`Pasted ${what}${skipped ? `; skipped ${skipped} widget${skipped > 1 ? 's' : ''} already in this workflow` : ''}.`)
  }

  // Fit, deselect, copy, paste, undo and redo shortcuts, skipped while typing in a field (which has its own undo).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'Escape') return setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)))
      if (e.shiftKey && e.code === 'Digit1') return fitView({ ...fitOptions, duration: 300 })
      if (!(e.ctrlKey || e.metaKey)) return
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
  // One-shot auto layout: every node glides to its place, the view stays put (a single undo step: history
  // waits for the edit to settle). Nodes stay movable and land on the grid.
  const arrange = () => {
    // The layout is centred on the origin; shift it to keep the top-left corner where the nodes' box is now,
    // so they don't jump out of the view.
    const laid = layout(nodes, edges, defs)
    const min = (ps, k) => Math.min(...Object.values(ps).map((p) => p[k]))
    const now = Object.fromEntries(nodes.map((n) => [n.id, n.position]))
    const [dx, dy] = [min(now, 'x') - min(laid, 'x'), min(now, 'y') - min(laid, 'y')]
    const to = Object.fromEntries(Object.entries(laid).map(([id, p]) => [id, snap({ x: p.x + dx, y: p.y + dy })]))
    const from = Object.fromEntries(nodes.map((n) => [n.id, n.position]))
    const move = { t: 0 }
    animate(move, {
      t: 1,
      duration: 300,
      ease: 'outQuad',
      onUpdate: () => setNodes((ns) => ns.map((n) => {
        const [a, b] = [from[n.id], to[n.id]]
        return a && b ? { ...n, position: { x: a.x + (b.x - a.x) * move.t, y: a.y + (b.y - a.y) * move.t } } : n
      })),
    })
  }
  // Links follow switch cases: a moved case keeps its links, a renamed one too, and a removed one takes them along.
  const setConfig = (config) => {
    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, config } } : n)))
    const def = defOf(selected)
    const key = def?.outputsFrom
    const before = selected.data.config[key] ?? def?.config[key]
    const after = config[key] ?? def?.config[key]
    if (!key || before === after) return
    const taken = new Set()
    const moved = {} // old output id -> new output id
    before.forEach((item, i) => {
      let j = after.findIndex((a, k) => a === item && !taken.has(k))
      if (j < 0 && before.length === after.length) j = i // renamed in place
      if (j < 0) return
      taken.add(j)
      moved[i + 1] = String(j + 1)
    })
    const fixed = def.outputs ?? []
    setEdges((es) => es.flatMap((e) => (e.source !== selected.id || fixed.includes(e.sourceHandle) ? [e]
      : moved[e.sourceHandle] ? [{ ...e, sourceHandle: moved[e.sourceHandle] }] : [])))
  }

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
          <Tooltip label={hasManual ? 'Run manual triggers' : 'Add a Manual Trigger to run this workflow by hand'}>
            <ActionIcon size="md" variant="light" color="green" disabled={!hasManual} onClick={() => fetch(`/api/workflows/${workflow.id}/run`, { method: 'POST' })}>
              <IconPlayerPlay size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Cancel the running workflow and its nodes">
            <ActionIcon size="md" variant="light" color="red" disabled={!firings} onClick={() => fetch(`/api/workflows/${workflow.id}/cancel`, { method: 'POST' })}>
              <IconPlayerStop size={18} />
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
          onConnectEnd={onConnectEnd}
          connectionRadius={0} // links snap to whole nodes (see linkAt), not to nearby handles
          className={preview ? 'previewing' : ''}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
          snapToGrid
          snapGrid={[GRID, GRID]}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onMouseMove={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}
          onMouseLeave={() => (pointer.current = null)}
          colorMode="dark"
          style={{ opacity: ready ? 1 : 0 }}
          minZoom={MIN_ZOOM}
          onMoveEnd={(e, viewport) => saveView(workflow.id, viewport)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#555" gap={20} />
          {/* All graph controls use the same outline icons (ReactFlow's own zoom and fit icons are filled). */}
          <Controls position="top-left" showZoom={false} showFitView={false} showInteractive={false}>
            <ControlButton className={locked ? 'locked' : ''} onClick={() => setLocked((l) => !l)} title={locked ? 'Unlock the graph' : 'Lock node positions'}>
              {locked ? <IconLock /> : <IconLockOpen />}
            </ControlButton>
            <ControlButton onClick={() => zoomIn({ duration: 200 })} title="Zoom in"><IconPlus /></ControlButton>
            <ControlButton onClick={() => zoomOut({ duration: 200 })} title="Zoom out"><IconMinus /></ControlButton>
            <ControlButton onClick={() => fitView({ ...fitOptions, duration: 300 })} title="Fit view (Shift+1)"><IconMaximize /></ControlButton>
            <ControlButton onClick={arrange} disabled={locked} title={locked ? 'Unlock the graph to arrange it' : 'Arrange nodes (once)'}>
              <IconSitemap style={{ transform: 'rotate(-90deg)' }} />
            </ControlButton>
          </Controls>
        </ReactFlow>
      </AppShell.Main>
      <Config
        workflow={workflow.id}
        node={selected}
        def={defOf(selected)}
        context={{
          vars: selected ? upstreamKeys(selected.id, { nodes, edges, defs, widgets, types }) : [],
          widget: findWidget(widgets, selected?.data.config.widget),
          // The widgets a Widget Callback node can pick: those with a widget node here.
          instances: nodes.filter((n) => n.data.type === 'widget').map((n) => findWidget(widgets, n.data.config.widget)).filter(Boolean)
            .map((w) => ({ value: w.id, label: `${w.name} (${w.id.slice(0, 8)})` })),
          // The widgets linked into the selected node (for a Merge Widgets node), in link order.
          inputs: [...new Set(edges.filter((e) => e.target === selected?.id).map((e) => nodes.find((n) => n.id === e.source))
            .filter((n) => n?.data.type === 'widget').map((n) => n.data.config.widget))].map((ref) => findWidget(widgets, ref)).filter(Boolean),
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
    get(`/api/workflows/${id}`).then(setWorkflow)
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
