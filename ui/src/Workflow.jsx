// Workflow editor: ReactFlow graph (center) and selected node settings (bottom), autosaved. A one-line workflow can
// also be shown as a list of steps (the Basic view, Basic.jsx), picked in the toolbar and saved with it as `view`.
// Nodes are dropped from the library: node types, or widget types (each drop creates a widget instance and its widget
// node). A widget node starts its widget (or runs the action its type binds to signals instead); a Widget Action node linked in
// front of it makes it run another one, picked in its settings. Ctrl/Cmd+C and Ctrl/Cmd+V copy nodes, also into another workflow; a
// pasted widget node is a new instance with a copy of the widget's state. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) undo and redo graph edits.
// Canvas rule: the view never moves on its own, except to keep the selected node in sight. Shift+1 fits the graph,
// Escape closes the node settings.
import { useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, ControlButton, MarkerType,
  useNodesState, useEdgesState, useNodesInitialized, addEdge, useReactFlow, useStore,
} from '@xyflow/react'
import { animate } from 'animejs'
import TimerBar from './TimerBar.jsx'
import '@xyflow/react/dist/style.css'
import {
  ActionIcon, AppShell, Button, Center, CloseButton, Divider, Group, Modal, Notification, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Tooltip,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconArrowBackUp, IconArrowForwardUp, IconBox, IconDownload, IconHierarchy2, IconLayoutSidebarRight, IconList, IconLock, IconLockOpen, IconMaximize, IconMinus,
  IconPlayerPlay, IconPlayerStop, IconPlus, IconSitemap,
  IconTrash,
} from '@tabler/icons-react'
import Fields, { applies } from './Fields.jsx'
import DeckGrid from './Deck.jsx'
import WidgetPane, { ActionsInfo } from './Widget.jsx'
import QueueLine from './QueueLine.jsx'
import JoinLinks from './JoinLinks.jsx'
import Play from './Play.jsx'
import LogResult from './LogResult.jsx'
import NodeLive from './NodeLive.jsx'
import ChatTest from './ChatTest.jsx'
import CodeTest from './CodeTest.jsx'
import Merge from './Merge.jsx'
import Notice from './Notice.jsx'
import FlowNode, { colors, outputsOf } from './FlowNode.jsx'
import layout from './layout.js'
import Basic from './Basic.jsx'
import { chainOf, relink } from './chain.js'
import { exportWorkflow, download, withWidgetIds } from './share.js'
import { get, json } from './api.js'
import { requirements } from './Settings.jsx'

const findWidget = (widgets, id) => widgets.find((w) => w.id === id)
// The widget instance a node points to: a widget node's own, or a Widget Action node's linked widget node's.
const widgetRef = (node, nodes, edges) => node?.data.type !== 'widget-action' ? node?.data.config.widget
  : nodes.find((n) => n.data.type === 'widget' && edges.some((e) => e.source === node.id && e.target === n.id))?.data.config.widget
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

// What a node needs (requirement keys, see Settings.jsx): its type's `needs`, its widget type's for a widget node, and
// those of the options picked in their settings ({ needs: key }, or { streamer: true }: Twitch in Streamer mode).
// config and widgetState: the settings with their defaults.
function needsOf(def, config, type, widgetState) {
  const picked = (fields = {}, values) => Object.entries(fields).flatMap(([key, f]) => {
    const option = f.options?.find((o) => o.value === values[key])
    return [option?.needs, option?.streamer && 'twitch'].filter(Boolean)
  })
  const own = [...(def?.needs ?? []), ...picked(def?.fields, config)]
  return type ? [...own, ...(type.needs ?? []), ...picked(type.fields, widgetState)] : own
}

// Data keys a node can use as {{key}}: what every node upstream of it adds (a manual trigger adds its JSON's keys,
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
      if (!node) continue // a link from a node that isn't there (a workflow file edited by hand) adds nothing
      const def = defs.find((d) => d.type === node.data.type)
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
// source itself). Only widget nodes link into a Merge Widgets node, and a Widget Action node links to one widget node at most.
function isValidConnection(c, edges, nodes) {
  const type = (id) => nodes.find((n) => n.id === id)?.data.type
  if (type(c.target) === 'merge' && type(c.source) !== 'widget') return false
  if (type(c.source) === 'widget-action' && type(c.target) === 'widget'
    && edges.some((e) => e.source === c.source && e.target !== c.target && type(e.target) === 'widget')) return false
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
// edges get an arrow like n8n, in the edge color (no color: the theme's, from app.css).
const nodeTypes = { step: FlowNode }
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '' } }
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

// Settings of the selected node, laid out the same for every node (see AGENTS.md): a header (icon, name, ⓘ for a
// widget's actions, close), the description, notices (needs not met, a widget to link or deleted, the last run's
// error), then the settings column, with a live column on its right when the node has something to watch or press: a
// widget's preview with Start, Stop and Cancel, a Control Pad's buttons, a Queue's line, a Wait For All's links with
// Force and Cancel, an action's Play and result (Play.jsx), a Log's last data (LogResult.jsx), a Cooldown's, Delay's
// or Fan In's state (NodeLive.jsx), a Chat !command's test Run (ChatTest.jsx), a Code node's Test (CodeTest.jsx). A Merge Widgets node shows its
// canvas instead (with the widgets linked into it, context.inputs). context.widget is the widget the node points to; off: the requirements not met (Settings.jsx).
function Config({ workflow, node, def, context, off, running, error, onChange, onWidgetChange, onCopy, onClose, onError }) {
  if (!node) return null
  // A type that isn't loaded (a custom node removed or broken): its settings are kept, untouched, until it is back.
  const unknown = !def
  def ??= { type: node.data.type, label: node.data.label ?? node.data.type, description: '', config: {} }
  const isWidget = def.type === 'widget'
  const isMerge = def.type === 'merge'
  const { widget } = context
  const type = widget && context.types.find((t) => t.type === widget.type)
  const config = { ...def.config, ...node.data.config }
  const needs = needsOf(def, config, isWidget && type, { ...type?.state, ...widget?.state })
  const missing = requirements.filter((r) => off.includes(r.key) && needs.includes(r.key))
  const Icon = (isWidget ? type : def)?.Icon ?? IconBox
  const settings = <Fields defaults={def.config} values={node.data.config} fields={def.fields} context={{ ...context, off }} onChange={onChange} />
  const live = def.type === 'deck' ? <DeckGrid workflow={workflow} node={node.id} config={config} />
    : def.queue ? <QueueLine workflow={workflow} node={node.id} />
    : def.join ? <JoinLinks workflow={workflow} node={node.id} links={context.links} />
    : def.type === 'log' ? <LogResult key={node.id} workflow={workflow} node={node.id} />
    : def.type === 'chat-command' ? <ChatTest key={node.id} workflow={workflow} node={node.id} config={config} />
    : def.type === 'code' ? <CodeTest key={node.id} workflow={workflow} node={node.id} config={config} />
    : def.live ? <NodeLive key={node.id} workflow={workflow} node={node.id} type={def.type} config={config} />
    : def.play && applies(def.play, config) && (
      <Play key={node.id} workflow={workflow} node={node.id} type={def.type} config={config} disabled={missing.length > 0} running={running} />
    )
  const notices = [
    ...missing.map((r) => <Notice key={r.key} settings={r.pane ?? r.key}>Needs {r.needs}.</Notice>),
    def.type === 'widget-action' && !widget && <Notice key="link">Link this node to a widget node to pick its action.</Notice>,
    isWidget && !type && (widget
      ? <Notice key="unknown" color="red" settings="widgets">Unknown widget type "{widget.type}": a custom widget that isn't loaded. Its settings are kept.</Notice>
      : <Notice key="deleted" color="red">This widget was deleted. Drop a new one from the library.</Notice>),
    unknown && <Notice key="unknown" color="red" settings="nodes">Unknown node type "{def.type}": a custom node that isn't loaded.</Notice>,
    error && <Notice key="error" color="red">Last run failed: {error}</Notice>,
  ].filter(Boolean)
  return (
    <AppShell.Footer>
      <div className={isWidget && !type ? 'pane' : 'pane split'}>
        <Group gap="xs" mb={4} wrap="nowrap">
          <Icon size={20} color={colors[def.category]} style={{ flexShrink: 0 }} />
          <Text fw={600} truncate>{isWidget ? widget?.state.name ?? 'Missing widget' : def.label}</Text>
          {/* The widget's actions, as its settings allow them now (e.g. Voting's "win" only for a prediction). */}
          {isWidget && type && (
            <ActionsInfo key={widget.id} type={type} state={{ ...type.state, ...widget.state }} />
          )}
          <CloseButton size="sm" ml="auto" aria-label="Close settings" onClick={onClose} />
        </Group>
        <Text size="xs" c="dimmed" mb="sm">{def.description}</Text>
        {notices.length > 0 && <Stack gap="xs" mb="sm">{notices}</Stack>}
        {isMerge ? (
          <Merge workflow={workflow} node={node.id} config={config} widgets={context.inputs} types={context.types} onChange={onChange} />
        ) : isWidget ? (
          type && <WidgetPane key={widget.id} widget={widget} type={type} context={context} off={off} onChange={onWidgetChange} onCopy={onCopy} onError={onError} />
        ) : (
          // Two equal halves, the right one empty when there's nothing live.
          <SimpleGrid className="widget-split" cols={2} spacing="xl">
            <Stack className="settings">{settings}</Stack>
            <Stack className="live" gap={0}>{live}</Stack>
          </SimpleGrid>
        )}
      </div>
    </AppShell.Footer>
  )
}

// openNode: id of the node whose settings were open last time; onNodeSelect(id | null) reports selection changes.
// off: the requirements not met (Settings.jsx). onBasic({ trigger, graph } | null) tells the library the Basic view is
// shown (it then offers only what keeps the workflow one line).
function Editor({ workflow, defs, widgets, types, off, openNode, onRename, onDelete, onWidgetChange, panels, onToggle, onNodeSelect, onBasic }) {
  const [name, setName] = useState(workflow.name)
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow.nodes.map((n) => ({ ...n, type: 'step', selected: n.id === openNode })),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const { screenToFlowPosition, getNodes, getViewport, setViewport, fitView, zoomIn, zoomOut } = useReactFlow()
  // A node's type, from the library's node types.
  const defOf = (n) => defs.find((d) => d.type === n?.data.type)
  const firstOutput = (n) => outputsOf(defOf(n), n.data.config)[0]?.id ?? null
  // Basic view: the nodes in order while the graph is one line (else null, and the graph is shown).
  const chain = chainOf(nodes, edges, { isTrigger: (n) => defOf(n)?.category === 'trigger', firstOutput })
  const [view, setView] = useState(workflow.view === 'basic' ? 'basic' : 'graph')
  const basic = view === 'basic' && !!chain
  useEffect(() => {
    if (view === 'basic' && !chain) setView('graph') // an undo brought a branch back
  }, [view, !chain])
  const hasTrigger = chain?.[0] && defOf(chain[0])?.category === 'trigger'
  useEffect(() => onBasic(basic ? { trigger: hasTrigger, graph: () => pickView('graph') } : null), [basic, hasTrigger])
  useEffect(() => () => onBasic(null), [])

  // Short feedback message (copy, paste, a node failing) shown over the graph for a few seconds.
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()
  const notify = (message, color = 'teal') => {
    setToast({ message, color, id: Date.now() })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Locked graph: nodes can't be moved, linked or deleted, but can still be clicked to open their settings.
  const [locked, setLocked] = useState(false)
  // Live run feedback from the engine (/api/activity): node id -> running | done | stopped | error | waiting, edge
  // id -> a token while data travels on it: a link animates for a moment, even into a node that runs for minutes (an
  // open vote), and node id -> its last error. Only for display: not saved, not part of undo.
  const [live, setLive] = useState({ nodes: {}, edges: {}, errors: {} })
  // Firings of this workflow in progress, for the Stop button.
  const [firings, setFirings] = useState(0)
  useEffect(() => {
    // A node that failed in a recent run (the engine's history, newest first) shows it until it runs again.
    get(`/api/runs?workflow=${workflow.id}`).then((runs) => {
      const last = {}
      for (const run of runs) for (const n of [...run.nodes].reverse()) last[n.node] ??= n
      const errors = Object.fromEntries(Object.values(last).filter((n) => n.error).map((n) => [n.node, n.error]))
      const states = Object.fromEntries(Object.keys(errors).map((id) => [id, 'error']))
      setLive((l) => ({ ...l, nodes: { ...states, ...l.nodes }, errors: { ...errors, ...l.errors } }))
    }, () => {})
    const timers = []
    // Finished states stay visible a moment, unless the node started again meanwhile; errors stay until then.
    const fade = (node, state, ms) => timers.push(setTimeout(() => setLive((l) => {
      if (l.nodes[node] !== state) return l
      const nodes = { ...l.nodes }
      delete nodes[node]
      return { ...l, nodes }
    }), ms))
    // A link stops animating 1.5s after data last went along it.
    let sent = 0
    const pass = (edge) => {
      const token = ++sent
      setLive((l) => ({ ...l, edges: { ...l.edges, [edge]: token } }))
      timers.push(setTimeout(() => setLive((l) => {
        if (l.edges[edge] !== token) return l
        const edges = { ...l.edges }
        delete edges[edge]
        return { ...l, edges }
      }), 1500))
    }
    // The shared activity stream (App.jsx).
    const onActivity = ({ detail: a }) => {
      if (a.widget) return onWidgetChange() // an action changed a widget's state: its settings show it
      if (a.workflow !== workflow.id) return
      if ('running' in a) return setFirings(a.running)
      if (a.edge) return pass(a.edge)
      setLive((l) => {
        const errors = { ...l.errors }
        if (a.state === 'error') errors[a.node] = a.error
        if (a.state === 'running') delete errors[a.node]
        return { ...l, nodes: { ...l.nodes, [a.node]: a.state }, errors }
      })
      if (a.state === 'error') notify(`${nameRef.current(a.node)} failed: ${a.error}`, 'red')
      if (!['running', 'waiting', 'error'].includes(a.state)) fade(a.node, a.state, 1500)
    }
    window.addEventListener('ovrly-activity', onActivity)
    return () => {
      window.removeEventListener('ovrly-activity', onActivity)
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
  // Each node gets what FlowNode draws (see there), and its name for screen readers.
  const shownNodes = nodes.map((n) => {
    const def = defOf(n)
    const widget = findWidget(widgets, widgetRef(n, nodes, edges))
    const widgetType = types.find((t) => t.type === widget?.type)
    const isWidget = n.data.type === 'widget'
    const needs = needsOf(def, { ...def?.config, ...n.data.config }, isWidget && widgetType, { ...widgetType?.state, ...widget?.state })
    const missing = requirements.filter((r) => off.includes(r.key) && needs.includes(r.key)).map((r) => r.needs)
    const context = { workflowId: workflow.id, def, widget, widgetType, missing }
    const shown = { ...n, ariaLabel: (isWidget ? widget?.state.name : def?.label) ?? n.data.label, data: { ...n.data, ...context, inputs: incoming[n.id]?.length } }
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

  // Debounced autosave. When Ovrly can't be reached, it says so and tries again every few seconds until it works.
  const [retry, setRetry] = useState(0)
  const unsaved = useRef(false)
  // The save waiting for its debounce: sent at once if the editor closes first (another workflow picked, the page left).
  const pending = useRef(null)
  useEffect(() => {
    pending.current = { name, view, ...graph }
    const timer = setTimeout(() => {
      pending.current = null
      fetch(`/api/workflows/${workflow.id}`, json('PUT', { name, view, ...graph })).then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        if (unsaved.current) notify('Saved.')
        unsaved.current = false
        onRename()
      }).catch(() => {
        unsaved.current = true
        notify('Not saved: is Ovrly running? Trying again…', 'red')
        setTimeout(() => setRetry((n) => n + 1), 3000)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [name, view, graphKey, retry])
  useEffect(() => {
    // keepalive lets a save outlive the page, for a body up to 64 KB: only when the page goes.
    const flush = (keepalive) => {
      if (!pending.current) return
      fetch(`/api/workflows/${workflow.id}`, { ...json('PUT', pending.current), keepalive }).then(onRename, () => {})
      pending.current = null
    }
    const onHide = () => flush(true)
    addEventListener('pagehide', onHide)
    return () => {
      removeEventListener('pagehide', onHide)
      flush(false)
    }
  }, [])

  useEffect(() => {
    for (const w of widgets) knownWidgets[w.id] = w
  }, [widgets])
  // Puts back the widget instances these nodes use that the server has deleted meanwhile.
  const restoreWidgets = async (list) => {
    const ids = new Set(list.filter((n) => n.data.type === 'widget').map((n) => n.data.config.widget))
    const missing = [...ids].filter((id) => knownWidgets[id] && !widgets.some((w) => w.id === id))
    for (const id of missing) {
      await fetch(`/api/widgets/${id}`, json('PUT', { type: knownWidgets[id].type, state: knownWidgets[id].state }))
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
  // Where a double-clicked library item goes: right of the node it is linked from (from), below any node already
  // there; else the canvas center when empty; a trigger goes above the top-right trigger, or left of the leftmost node
  // when there is none; anything else goes right of the top-right node.
  const spawnPosition = (def, from) => {
    const topRight = (list) => list.reduce((a, b) => (b.position.x > a.position.x || (b.position.x === a.position.x && b.position.y < a.position.y) ? b : a))
    const triggers = nodes.filter((n) => defOf(n)?.category === 'trigger')
    let p
    if (from) {
      p = { x: from.position.x + (from.measured?.width ?? NODE) + GRID * 3, y: from.position.y }
      while (nodes.some((n) => Math.abs(n.position.x - p.x) < NODE && Math.abs(n.position.y - p.y) < NODE)) p.y += NODE + CAPTION
    } else if (!nodes.length) {
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
  // The new node is selected, which opens its settings; a double-clicked one is also linked from the selected node.
  const addItem = async (widgetType, nodeType, position) => {
    const type = types.find((t) => t.type === widgetType)
    const def = defs.find((d) => d.type === (type ? 'widget' : nodeType))
    if (!def) return
    const spawned = !position // double-clicked, not dropped
    const from = spawned && def.category !== 'trigger' ? nodes.find((n) => n.selected) : null
    position ??= spawnPosition(def, from)
    let config = {}
    // An ID setting (a Called By Workflow trigger's) starts unique.
    for (const [key, f] of Object.entries(def.fields ?? {})) if (f.type === 'id') config[key] = crypto.randomUUID()
    // An option needing an integration (a Control Pad node's Stream Deck mode) is picked when that integration is ready.
    for (const [key, f] of Object.entries(def.fields ?? {})) {
      const option = f.options?.find((o) => o.needs)
      if (option && !off.includes(option.needs)) config[key] = option.value
    }
    if (type) {
      // Signed in to Twitch (Streamer mode): a widget with a Twitch mode (Voting) starts in it.
      const twitch = type.fields?.mode?.options?.find((o) => o.streamer)
      const mode = twitch && (await get('/api/twitch')).streamer ? { mode: twitch.value } : {}
      const res = await fetch('/api/widgets', json('POST', { type: type.type, state: mode }))
      config = { widget: (await res.json()).id }
      onWidgetChange()
    }
    const node = { id: crypto.randomUUID(), type: 'step', position, selected: true, data: { type: def.type, label: def.label, config } }
    if (basic) return setChain(def.category === 'trigger' ? [node, ...chain] : [...chain, node], node.id)
    setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)).concat(node))
    // From the selected node's first output; the same checks as a link drawn by hand.
    const link = from && { source: from.id, sourceHandle: outputsOf(defOf(from), from.data.config)[0]?.id ?? null, target: node.id }
    if (link && isValidConnection(link, edges, [...nodes, node])) setEdges((es) => addEdge(link, es))
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

  // Basic view edits: the nodes in their new order (selecting one, or none), relinked in a row on the grid where the
  // line starts, so the graph is tidy too.
  const setChain = (list, select) => {
    const start = chain[0]?.position ?? { x: 0, y: 0 }
    setNodes(list.map((n, i) => ({ ...n, selected: n.id === select, position: { x: start.x + i * (NODE + CAPTION + GRID), y: start.y } })))
    setEdges(relink(list, edges, firstOutput))
  }
  const moveStep = (id, by) => {
    const list = [...chain]
    const i = list.findIndex((n) => n.id === id)
    ;[list[i], list[i + by]] = [list[i + by], list[i]]
    setChain(list, selected?.id)
  }
  // Back to the graph: fitted, as the Basic edits moved its nodes.
  const pickView = (v) => {
    setView(v)
    if (v === 'graph') requestAnimationFrame(() => fitView(fitOptions))
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

  const nodeName = (n) => (n.data.type === 'widget' ? findWidget(widgets, n.data.config.widget)?.state.name : defOf(n)?.label) ?? n.data.label
  // A node's name from the graph as it is now, for the activity stream (set up once, on opening).
  const nameRef = useRef()
  nameRef.current = (id) => {
    const n = nodes.find((n) => n.id === id)
    return n ? nodeName(n) : 'A node'
  }
  const copy = (picked) => {
    const ids = picked.map((n) => n.id)
    clipboard = { nodes: picked, edges: edges.filter((ed) => ids.includes(ed.source) && ids.includes(ed.target)) }
    const what = picked.length === 1 ? nodeName(picked[0]) : `${picked.length} nodes`
    notify(`Copied ${what}. Paste with Ctrl+V, here or in another workflow.`)
  }
  // Pasted nodes get new ids (their ID settings too) and keep their layout, centered on the pointer (or the canvas when the pointer is
  // elsewhere). A pasted widget node gets a new widget instance, with a copy of the copied one's state (settings,
  // inputs, kept data); one whose instance is unknown (deleted) is pasted as it is, and says so in its settings.
  const pointer = useRef(null)
  const paste = async () => {
    const { nodes: copied, edges: links } = clipboard
    const ids = Object.fromEntries(copied.map((n) => [n.id, crypto.randomUUID()]))
    const instances = {} // copied widget id -> its new instance's id
    for (const n of copied.filter((n) => n.data.type === 'widget' && knownWidgets[n.data.config.widget])) {
      const { type, state } = knownWidgets[n.data.config.widget]
      const res = await fetch('/api/widgets', json('POST', { type, state: structuredClone(state) }))
      if (res.ok) instances[n.data.config.widget] = (await res.json()).id
    }
    const r = flowRef.current.getBoundingClientRect()
    const at = screenToFlowPosition(pointer.current ?? { x: r.x + r.width / 2, y: r.y + r.height / 2 })
    const b = boundsOf(copied)
    const d = snap({ x: at.x - b.x - b.width / 2, y: at.y - b.y - b.height / 2 })
    // A Merge Widgets node pasted with its widget nodes keeps their placement, now keyed by the new instances.
    const newIds = (n) => Object.entries(defOf(n)?.fields ?? {}).filter(([, f]) => f.type === 'id').map(([key]) => [key, crypto.randomUUID()])
    const pasted = withWidgetIds(copied, instances).map((n) => ({ ...n, id: ids[n.id], selected: true, position: { x: n.position.x + d.x, y: n.position.y + d.y },
      data: { ...n.data, config: { ...n.data.config, ...Object.fromEntries(newIds(n)) } } }))
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pasted))
    setEdges((es) => es.concat(links.map((ed) => ({ ...ed, id: crypto.randomUUID(), source: ids[ed.source], target: ids[ed.target] }))))
    if (Object.keys(instances).length) onWidgetChange()
    notify(`Pasted ${copied.length === 1 ? nodeName(copied[0]) : `${copied.length} nodes`}.`)
  }

  // Deselecting closes the node settings (Escape, or their close button).
  const deselect = () => setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)))
  // Fit, deselect, copy, paste, undo and redo shortcuts, skipped while typing in a field (which has its own undo) or in
  // a dialog (whose Escape closes the dialog only).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, [contenteditable], [role=dialog]')) return
      if (e.key === 'Escape') return deselect()
      if (e.shiftKey && e.code === 'Digit1') return fitView({ ...fitOptions, duration: 300 })
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const picked = nodes.filter((n) => n.selected)
      if (key === 'c' && picked.length) copy(picked)
      if (key === 'v' && clipboard && !basic) paste() // pasted nodes would be off the line
      if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else if (key === 'z') undo()
      if (key === 'z' || key === 'y') e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [nodes, edges, widgets, basic])

  const selected = nodes.find((n) => n.selected)
  // The shell shows the bottom (node settings) pane for the selected node, and remembers it per workflow.
  useEffect(() => {
    onNodeSelect(selected?.id ?? null)
  }, [selected?.id])
  const hasManual = nodes.some((n) => n.data.type === 'manual')
  const scheme = useComputedColorScheme('dark')
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
  // Items with an id (Control Pad buttons) are their own output id: only a removed one has links to drop.
  const setConfig = (config) => {
    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, config } } : n)))
    const def = defOf(selected)
    const key = def?.outputsFrom
    const before = selected.data.config[key] ?? def?.config[key]
    const after = config[key] ?? def?.config[key]
    if (!key || before === after) return
    if ([...before, ...after].some((item) => item?.id)) {
      const ids = new Set(after.map((item) => item.id))
      return setEdges((es) => es.filter((e) => e.source !== selected.id || ids.has(e.sourceHandle)))
    }
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
        <Group gap="xs" p="xs" wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Tooltip label="Has branches: edit it in the graph" disabled={!!chain}>
            <SegmentedControl size="xs" value={basic ? 'basic' : 'graph'} onChange={pickView} aria-label="View" data={[
              { value: 'basic', disabled: !chain, label: <Group gap={4} wrap="nowrap"><IconList size={14} />Basic</Group> },
              { value: 'graph', label: <Group gap={4} wrap="nowrap"><IconHierarchy2 size={14} />Graph</Group> },
            ]} />
          </Tooltip>
          <Tooltip label="Undo (Ctrl+Z)">
            <ActionIcon size="md" variant="default" aria-label="Undo" disabled={!history.current.past.length} onClick={undo}><IconArrowBackUp size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Shift+Z)">
            <ActionIcon size="md" variant="default" aria-label="Redo" disabled={!history.current.future.length} onClick={redo}><IconArrowForwardUp size={18} /></ActionIcon>
          </Tooltip>
          <TextInput flex={1} miw={80} size="xs" aria-label="Workflow name" value={name} onChange={(e) => setName(e.target.value)} />
          <Tooltip label={hasManual ? 'Run manual triggers' : 'Add a Manual Trigger to run this workflow by hand'}>
            <ActionIcon size="md" variant="light" color="green" aria-label="Run manual triggers" disabled={!hasManual} onClick={() => fetch(`/api/workflows/${workflow.id}/run`, { method: 'POST' })}>
              <IconPlayerPlay size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Stop the workflow (cancels its running nodes)">
            <ActionIcon size="md" variant="light" color="red" aria-label="Stop the workflow" disabled={!firings} onClick={() => fetch(`/api/workflows/${workflow.id}/cancel`, { method: 'POST' })}>
              <IconPlayerStop size={18} />
            </ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label="Export as JSON">
            <ActionIcon size="md" variant="default" aria-label="Export as JSON" onClick={() => exportWorkflow(workflow.id).then((b) => download(b, name))}><IconDownload size={18} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Delete workflow">
            <ActionIcon size="md" variant="default" aria-label="Delete workflow" onClick={() => setConfirmDelete(true)}><IconTrash size={18} /></ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label={`${panels.library ? 'Hide' : 'Show'} node library`}>
            <ActionIcon size="md" variant={panels.library ? 'light' : 'default'} aria-label={`${panels.library ? 'Hide' : 'Show'} node library`} aria-pressed={panels.library}
              onClick={() => onToggle('library')}>
              <IconLayoutSidebarRight size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete workflow?" size="sm">
          <Text size="sm" mb="lg">
            "{name}" will be deleted, with the widgets no other workflow uses. This can't be undone.
          </Text>
          <Group justify="end" gap="xs">
            <Button variant="default" onClick={() => setConfirmDelete(false)} data-autofocus>Cancel</Button>
            {/* No save on the way out: it would bring the workflow back. */}
            <Button color="red" onClick={() => { pending.current = null; onDelete() }}>Delete</Button>
          </Group>
        </Modal>
        {toast && (
          <Notification withCloseButton={false} className="toast timed" color={toast.color}>
            {toast.message}
            <TimerBar key={toast.id} ms={3000} />
          </Notification>
        )}
        {/* An empty graph says how to start. */}
        {ready && !basic && !nodes.length && (
          <Center className="empty-hint">
            <Stack align="center" gap="xs">
              <Text c="dimmed" ta="center">Start with a trigger: drag one from the library onto the graph, or double-click it.</Text>
              {!panels.library && <Button size="xs" variant="light" onClick={() => onToggle('library')}>Show the library</Button>}
            </Stack>
          </Center>
        )}
        {basic && (
          <Basic list={chain.map((n) => shownNodes.find((s) => s.id === n.id))}
            onSelect={(id) => setNodes((ns) => ns.map((n) => (n.selected !== (n.id === id) ? { ...n, selected: n.id === id } : n)))}
            onMove={moveStep} onDelete={(id) => setChain(chain.filter((n) => n.id !== id), selected?.id)}
            onLibrary={() => !panels.library && onToggle('library')}
            onDrop={(e) => {
              e.preventDefault()
              addItem(e.dataTransfer.getData('application/ovrly-widget'), e.dataTransfer.getData('application/ovrly'))
            }} />
        )}
        {/* Kept (hidden) under the Basic view, so its nodes stay measured for a switch back. */}
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
          className={basic ? 'under-basic' : preview ? 'previewing' : ''}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          deleteKeyCode={locked || basic ? null : ['Backspace', 'Delete']}
          snapToGrid
          snapGrid={[GRID, GRID]}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onMouseMove={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}
          onMouseLeave={() => (pointer.current = null)}
          colorMode={scheme}
          style={{ opacity: ready ? 1 : 0 }}
          minZoom={MIN_ZOOM}
          onMoveEnd={(e, viewport) => saveView(workflow.id, viewport)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
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
        off={off}
        running={live.nodes[selected?.id] === 'running'}
        error={live.errors[selected?.id]}
        context={{
          vars: selected ? upstreamKeys(selected.id, { nodes, edges, defs, widgets, types }) : [],
          trigger: defOf(selected)?.category === 'trigger',
          widget: findWidget(widgets, widgetRef(selected, nodes, edges)),
          // The widgets linked into the selected node (for a Merge Widgets node), in link order.
          inputs: [...new Set(edges.filter((e) => e.target === selected?.id).map((e) => nodes.find((n) => n.id === e.source))
            .filter((n) => n?.data.type === 'widget').map((n) => n.data.config.widget))].map((ref) => findWidget(widgets, ref)).filter(Boolean),
          // The links into the selected node, named after the node each comes from (for Wait For All).
          links: edges.filter((e) => e.target === selected?.id).map((e) => ({ id: e.id, name: shownNodes.find((n) => n.id === e.source)?.ariaLabel })),
          types,
        }}
        onChange={setConfig}
        onWidgetChange={onWidgetChange}
        onCopy={() => copy([selected])}
        onClose={deselect}
        onError={() => notify('Widget settings not saved: is Ovrly running? Trying again…', 'red')}
      />
    </>
  )
}

export default function Workflow({ id, onChange, ...props }) {
  const [workflow, setWorkflow] = useState(null)
  // Why it can't be opened, e.g. deleted in another tab; the list is fetched again, so a deleted one leaves it.
  const [failed, setFailed] = useState('')
  useEffect(() => {
    get(`/api/workflows/${id}`).then(setWorkflow, (err) => {
      setFailed(err.message)
      onChange(id)
    })
  }, [id])

  const onDelete = async () => {
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    onChange(null)
  }

  if (failed) {
    return (
      <AppShell.Main className="editor">
        <Center flex={1}><Text c="dimmed">Can't open this workflow ({failed}).</Text></Center>
      </AppShell.Main>
    )
  }
  if (!workflow) return null
  return (
    <ReactFlowProvider>
      <Editor workflow={workflow} onRename={() => onChange(id)} onDelete={onDelete} {...props} />
    </ReactFlowProvider>
  )
}
