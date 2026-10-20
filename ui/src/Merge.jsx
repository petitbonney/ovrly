// Merge Widgets node settings: hints beside a 16:9 canvas (with the OBS link above it, as in widget nodes) where each
// widget linked into the node is a live preview box, dragged to move it and resized from its corner. Boxes snap to the
// canvas borders and center lines and to the other boxes' edges, unless Alt is held. The placement is saved in the
// node's config (layout), as fractions of the canvas.
import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Anchor, CopyButton, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'

// The reference canvas, as on the overlay page (server/merge.html), which scales it to the source's size.
const W = 1920
const H = 1080
const SNAP = 8 // screen pixels

// A widget's saved placement (x and y from the canvas center to the box's center, w and h its size, all fractions of
// the canvas) to a box in canvas pixels ({ x, y } its top left corner), and back. A widget not placed yet: half the
// canvas, cascading (the same default as the server's mergeView).
const toBox = (p = {}, i) => {
  const { x = 0.03 * i, y = 0.03 * i, w = 0.5, h = 0.5 } = p
  return { x: (0.5 + x - w / 2) * W, y: (0.5 + y - h / 2) * H, w: w * W, h: h * H }
}
const round = (v) => Math.round(v * 10000) / 10000
const toPlace = (b) => ({ x: round((b.x + b.w / 2) / W - 0.5), y: round((b.y + b.h / 2) / H - 0.5), w: round(b.w / W), h: round(b.h / H) })
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

// The smallest shift, within reach, that puts one of the edges on one of the lines: { d, line }, or { d: 0 } if none.
function snap(edges, lines, reach) {
  let best = { d: 0 }
  for (const e of edges) {
    for (const line of lines) {
      if (Math.abs(line - e) <= reach && (best.line === undefined || Math.abs(line - e) < Math.abs(best.d))) best = { d: line - e, line }
    }
  }
  return best
}

// widgets: the widget instances linked into the node, in link order (later ones are drawn on top). Those of a type
// with nothing to see (visual: false, e.g. Sound) get no box: only a hidden page, so they still play in the preview.
export default function Merge({ workflow, node, config, widgets, types, onChange }) {
  const visual = (w) => types.find((t) => t.type === w.type)?.visual !== false
  const { layout = {} } = config
  const url = `${location.origin}/m/${workflow}/${node}`
  // Canvas scale per axis: the canvas fills the space left in the pane, as the previews of the other widget nodes do.
  const ref = useRef()
  const [scale, setScale] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale({ x: entry.contentRect.width / W, y: entry.contentRect.height / H }))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  // One stream for the previews, as on the overlay page (server/merge.html): the widget pages marked data-merged listen
  // to it instead of opening one each (browsers allow only 6 connections per server), from their last message.
  useEffect(() => {
    window.mergeSource = new EventSource(`${url}/events`)
    window.mergeLast = {}
    return () => {
      window.mergeSource.close()
      delete window.mergeSource
    }
  }, [url])
  const ids = widgets.map((w) => w.id).join()
  useEffect(() => {
    const keep = (e) => (window.mergeLast[e.type] = e.data)
    for (const w of widgets) window.mergeSource.addEventListener(w.id, keep)
    return () => widgets.forEach((w) => window.mergeSource?.removeEventListener(w.id, keep))
  }, [url, ids])
  // The box being dragged, { id, box, guides: { x, y } (the lines it snapped to) }, while the pointer is down; saved on release.
  const [moving, setMoving] = useState(null)

  // mode: 'move' (the box) or 'size' (its corner handle).
  const grab = (e, id, i, mode) => {
    e.preventDefault()
    e.stopPropagation()
    const start = toBox(layout[id], i)
    const from = { x: e.clientX, y: e.clientY }
    const others = widgets.filter((w) => w.id !== id && visual(w)).map((w) => toBox(layout[w.id], widgets.indexOf(w)))
    const xs = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x + o.w])]
    const ys = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y + o.h])]
    let box = start
    const onMove = (ev) => {
      const reach = ev.altKey ? 0 : SNAP / scale.x
      const dx = (ev.clientX - from.x) / scale.x
      const dy = (ev.clientY - from.y) / scale.y
      if (mode === 'move') {
        const x = clamp(start.x + dx, 0, W - start.w)
        const y = clamp(start.y + dy, 0, H - start.h)
        const sx = snap([x, x + start.w / 2, x + start.w], xs, reach)
        const sy = snap([y, y + start.h / 2, y + start.h], ys, reach)
        box = { ...start, x: x + sx.d, y: y + sy.d }
        setMoving({ id, box, guides: { x: sx.line, y: sy.line } })
      } else {
        const w = clamp(start.w + dx, 40, W - start.x)
        const h = clamp(start.h + dy, 40, H - start.y)
        const sx = snap([start.x + w], xs, reach)
        const sy = snap([start.y + h], ys, reach)
        box = { ...start, w: w + sx.d, h: h + sy.d }
        setMoving({ id, box, guides: { x: sx.line, y: sy.line } })
      }
    }
    const onUp = () => {
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      setMoving(null)
      if (box !== start) onChange({ ...config, layout: { ...layout, [id]: toPlace(box) } })
    }
    addEventListener('pointermove', onMove)
    addEventListener('pointerup', onUp)
  }

  return (
    <Group className="widget-split" align="stretch" gap="xl" wrap="nowrap">
      <Stack className="settings" gap="md" flex="0 1 320px" miw={0}>
        <Text size="xs" c="dimmed">
          Any source size works: the canvas stretches to the space left, widgets included. Widgets snap to
          edges and center lines while dragged: hold Alt to place one freely.
        </Text>
        {!widgets.length && <Text size="xs" c="dimmed">Link widget nodes into this node to place them here.</Text>}
      </Stack>
      <Stack gap={0} flex="1 1 320px" miw={0}>
        <Group gap={6} mb="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>OBS browser source:</Text>
          <Tooltip label="Open in a new tab"><Anchor size="xs" href={url} target="_blank" truncate>{url}</Anchor></Tooltip>
          <CopyButton value={url}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy link'}>
                <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
        <div ref={ref} className="merge-fit">
          <div className="preview merge-canvas" style={{ width: '100%', height: '100%' }}>
            {widgets.map((w, i) => {
              if (!visual(w)) return <iframe key={w.id} src={`/w/${w.id}`} data-merged="" title={w.name} hidden />
              const b = moving?.id === w.id ? moving.box : toBox(layout[w.id], i)
              return (
                <div key={w.id} className="merge-box" style={{ left: b.x * scale.x, top: b.y * scale.y, width: b.w * scale.x, height: b.h * scale.y, zIndex: i }}
                  onPointerDown={(e) => grab(e, w.id, i, 'move')}>
                  <iframe src={`/w/${w.id}`} data-merged="" title={w.name} style={{ width: b.w, height: b.h, transform: `scale(${scale.x}, ${scale.y})` }} />
                  <span className="name">{w.name}</span>
                  <span className="corner" onPointerDown={(e) => grab(e, w.id, i, 'size')} />
                </div>
              )
            })}
            {moving?.guides.x !== undefined && <div className="merge-guide x" style={{ left: moving.guides.x * scale.x }} />}
            {moving?.guides.y !== undefined && <div className="merge-guide y" style={{ top: moving.guides.y * scale.y }} />}
          </div>
        </div>
      </Stack>
    </Group>
  )
}
