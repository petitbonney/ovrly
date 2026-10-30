// Basic view of a one-line workflow (chain.js): its trigger under "When", its steps under "Then", and a dashed "+" placeholder for the next one, on
// one line drawn behind them. A card opens the node's settings, like a click on the graph; its grip drags it to another place (Escape puts it back);
// Alt+↑ / Alt+↓ and its menu move it too, gliding the same way; the menu deletes it; the trigger's bolt fires it. Library items dropped here are
// added at the end (a trigger at the top).
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { animate } from 'animejs'
import { ActionIcon, Menu, Stack, Text, VisuallyHidden } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconBox, IconDots, IconGripVertical, IconPlugOff, IconPlus, IconTrash } from '@tabler/icons-react'
import { Bolt, colors, subtitle } from './FlowNode.jsx'

const GAP = 20 // between cards, where the line shows
const EDGE = 48 // how near the list's top or bottom a dragged step scrolls it

const Title = ({ children }) => <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md" mb={6}>{children}</Text>
const Gap = () => <div style={{ height: GAP }} />
const Key = ({ children }) => <Text size="xs" c="dimmed">{children}</Text>

// list: the chain's nodes as the graph shows them (data with def, widget, missing; className with the run state).
// onSelect(id), onMove(id, index in list), onDelete(id), onLibrary(): shows the library, onDrop(e).
export default function Basic({ list, onSelect, onMove, onDelete, onLibrary, onDrop }) {
  const trigger = list[0]?.data.def?.category === 'trigger'
  const first = trigger ? 1 : 0 // where the steps start in list
  // The step moving (dragged by its grip, or by a key or its menu): it is dy from its place (from), the steps between its
  // place and where it would land (to) making room for it (h, its height), a dashed outline where it would land (at land),
  // until it glides there (end: its dy then), put down (glide: no longer lifted).
  const [drag, setDrag] = useState(null) // { id, from, to, dy, h, land, end, glide }
  // The other steps' offsets meanwhile (s0, s1…, by index), slid by anime.js: a CSS transition could still be running when
  // the new order is saved, and Chrome then replays it from a wrong offset.
  const [room, setRoom] = useState({})
  const roomRef = useRef({}) // { at: the offsets anime.js moves, anim: that slide }
  const [said, setSaid] = useState('') // the last move, for screen readers
  const scrollRef = useRef()
  const stepsRef = useRef()
  const steps = list.slice(first)
  // Moves a step to index i in steps; from the keyboard, its card keeps the focus.
  const move = (id, i, focus) => {
    onMove(id, first + i)
    setSaid(`Moved ${steps.find((n) => n.id === id).ariaLabel} to step ${i + 1} of ${steps.length}.`)
    if (focus) requestAnimationFrame(() => stepsRef.current?.querySelector(`[data-id="${id}"]`)?.focus())
  }
  // The steps' places, measured before a move; at(to): the move of step id landing at index to.
  const measure = (id) => {
    const slots = [...stepsRef.current.querySelectorAll(':scope > .basic-slot')].map((el) => el.getBoundingClientRect())
    const from = steps.findIndex((n) => n.id === id)
    const h = slots[from].height
    const end = (to) => to > from ? slots[to].bottom - h - slots[from].top : to < from ? slots[to].top - slots[from].top : 0
    const at = (to) => ({ id, from, to, dy: 0, h, land: slots[from].top - slots[0].top + end(to), end: end(to) })
    return { slots, from, h, at }
  }
  // The others slide to make room for move d.
  const makeRoom = (d) => {
    const r = roomRef.current
    const to = Object.fromEntries(steps.map((n, i) => [`s${i}`, d.from < i && i <= d.to ? -d.h : d.to <= i && i < d.from ? d.h : 0]))
    r.at = Object.fromEntries(Object.keys(to).map((k) => [k, r.at?.[k] ?? 0]))
    r.anim?.pause()
    r.anim = animate(r.at, { ...to, duration: 150, ease: 'outQuad', onUpdate: () => setRoom({ ...r.at }) })
  }
  // It glides to where it lands, put down on the way, then the new order is saved. Put down first, as React may move its card
  // in the page to reorder, which would skip the transition and snap it down.
  const glide = (d, focus) => {
    d = { ...d, glide: true }
    setDrag(d)
    makeRoom(d)
    const g = { dy: d.dy }
    animate(g, {
      dy: d.end,
      duration: 150,
      ease: 'outQuad',
      onUpdate: () => setDrag({ ...d, dy: g.dy }),
      onComplete: () => {
        // Cleared and saved in one render, before the next paint (anime.js calls back from an animation frame, React would
        // render later): a render of the new order with the offsets of the old one would make the steps jump.
        roomRef.current.anim?.pause()
        roomRef.current = {}
        flushSync(() => {
          setDrag(null)
          setRoom({})
          if (d.to !== d.from) move(d.id, d.to, focus)
        })
      },
    })
  }
  // A key or the menu: one place up or down.
  const slide = (id, to, focus) => {
    if (drag) return // the last one is still gliding
    glide(measure(id).at(to), focus)
  }
  const grab = (e, id) => {
    e.preventDefault()
    if (drag) return
    const box = scrollRef.current
    const { slots, from, h, at } = measure(id)
    const scrolled = box.scrollTop
    let d = at(from)
    let y = e.clientY
    let frame
    // Where it lands: after the other steps whose middle is above its own, where the pointer took it (drawn between the
    // first and last step: past them, it lands first or last whatever their heights). The slots were measured before any
    // scrolling, hence the scroll since.
    const update = () => {
      const moved = y - e.clientY + box.scrollTop - scrolled
      const dy = Math.min(Math.max(moved, slots[0].top - slots[from].top), slots.at(-1).top - slots[from].top)
      const middle = slots[from].top + moved + h / 2
      const to = slots.filter((r, k) => k !== from && r.top + r.height / 2 < middle).length
      if (to !== d.to) makeRoom(at(to))
      if (dy !== d.dy || to !== d.to) setDrag(d = { ...at(to), dy })
    }
    // Each frame: scrolls the list while the pointer is near its top or bottom, then follows it.
    const tick = () => {
      const r = box.getBoundingClientRect()
      const near = (over) => Math.min(Math.max(over, 0), EDGE) / 4
      box.scrollTop += near(y - r.bottom + EDGE) - near(r.top + EDGE - y)
      update()
      frame = requestAnimationFrame(tick)
    }
    const listeners = {
      pointermove: (ev) => { y = ev.clientY },
      pointerup: () => settle(true),
      pointercancel: () => settle(false),
      blur: () => settle(false),
      keydown: (ev) => ev.key === 'Escape' && settle(false),
    }
    // Dropped, it lands; cancelled, back to its place.
    const settle = (drop) => {
      cancelAnimationFrame(frame)
      for (const [type, fn] of Object.entries(listeners)) removeEventListener(type, fn)
      glide(drop ? d : { ...at(from), dy: d.dy })
    }
    for (const [type, fn] of Object.entries(listeners)) addEventListener(type, fn)
    setDrag(d)
    frame = requestAnimationFrame(tick)
  }
  const shift = (i) => !drag ? 0 : i === drag.from ? drag.dy : room[`s${i}`] ?? 0
  const card = (n, i) => {
    const isTrigger = n === list[0] && trigger
    const Icon = (n.data.type === 'widget' ? n.data.widgetType : n.data.def)?.Icon ?? IconBox
    const sub = subtitle(n.data)
    const onKeyDown = (e) => {
      if (e.key === 'Enter') onSelect(n.id)
      const by = !isTrigger && e.altKey && { ArrowUp: -1, ArrowDown: 1 }[e.key]
      if (by && steps[i + by]) {
        e.preventDefault()
        slide(n.id, i + by, true)
      }
    }
    return (
      <div key={n.id} className={`basic-card ${n.className ?? ''}`}>
        <div className={`basic-step${isTrigger ? ' trigger' : ''}${n.selected ? ' selected' : ''}${drag?.id === n.id && !drag.glide ? ' dragging' : ''}`}
          role="button" tabIndex={0} aria-label={n.ariaLabel} data-id={n.id} onClick={() => onSelect(n.id)} onKeyDown={onKeyDown}>
          {isTrigger && n.data.def?.manual && <Bolt onFire={n.data.fire} />}
          {!isTrigger && (
            <div className="grip" title="Drag to move" onPointerDown={(e) => grab(e, n.id)} onClick={(e) => e.stopPropagation()}>
              <IconGripVertical size={18} />
            </div>
          )}
          <Icon size={28} stroke={1.5} color={colors[n.data.def?.category]} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} truncate>{n.ariaLabel}</Text>
            {sub && <Text size="xs" c="dimmed" truncate>{sub}</Text>}
          </div>
          {n.data.missing.length > 0 && (
            <IconPlugOff size={16} color="var(--mantine-color-yellow-text)" aria-label={n.data.missing.map((m) => `Needs ${m}.`).join(' ')} />
          )}
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Step actions" onClick={(e) => e.stopPropagation()}><IconDots size={16} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
              {!isTrigger && <Menu.Item leftSection={<IconArrowUp size={14} />} rightSection={<Key>Alt+↑</Key>} disabled={i === 0} onClick={() => slide(n.id, i - 1)}>Move up</Menu.Item>}
              {!isTrigger && <Menu.Item leftSection={<IconArrowDown size={14} />} rightSection={<Key>Alt+↓</Key>} disabled={i === steps.length - 1} onClick={() => slide(n.id, i + 1)}>Move down</Menu.Item>}
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete(n.id)}>Delete</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    )
  }
  return (
    <div ref={scrollRef} className={`basic${drag ? ' sorting' : ''}`} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <Stack className="basic-list" gap={0}>
        <Title>When</Title>
        <div className="basic-chain">
          {trigger ? card(list[0]) : (
            <button className="basic-step trigger empty" onClick={onLibrary}>
              <Text size="sm" c="dimmed">Pick a trigger in the library: double-click it, or drag it here.</Text>
            </button>
          )}
          {list.length > 0 && (
            <>
              <Gap /><Title>Then</Title>
              <div ref={stepsRef} className="basic-steps">
                {drag && <div className="basic-landing" style={{ top: drag.land, height: drag.h - GAP }} />}
                {steps.map((n, i) => (
                  <div key={n.id} className={`basic-slot${drag?.id === n.id ? ' moving' : ''}`} style={{ transform: shift(i) ? `translateY(${shift(i)}px)` : undefined }}>
                    {card(n, i)}<Gap />
                  </div>
                ))}
              </div>
              <div className="basic-step add" aria-hidden><IconPlus size={20} /></div>
            </>
          )}
        </div>
        {list.length > 0 && <Text size="xs" c="dimmed" ta="center" mt={4}>Double-click a node in the library, or drag it here.</Text>}
      </Stack>
      <VisuallyHidden aria-live="polite">{said}</VisuallyHidden>
    </div>
  )
}
