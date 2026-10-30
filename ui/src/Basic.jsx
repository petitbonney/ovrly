// Basic view of a one-line workflow (chain.js): its trigger under "When", its steps under "Then", and a dashed "+" placeholder for the next one. A card
// opens the node's settings, like a click on the graph; its grip drags it to another place; its menu moves or deletes it; the trigger's bolt fires
// it. Library items dropped here are added at the end (a trigger at the top).
import { useRef, useState } from 'react'
import { ActionIcon, Menu, Stack, Text } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconBox, IconDots, IconGripVertical, IconPlugOff, IconPlus, IconTrash } from '@tabler/icons-react'
import { Bolt, colors, subtitle } from './FlowNode.jsx'

const Title = ({ children }) => <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md" mb={6}>{children}</Text>
const Link = () => <div className="basic-link" />

// list: the chain's nodes as the graph shows them (data with def, widget, missing; className with the run state).
// onSelect(id), onMove(id, index in list), onDelete(id), onLibrary(): shows the library, onDrop(e).
export default function Basic({ list, onSelect, onMove, onDelete, onLibrary, onDrop }) {
  const trigger = list[0]?.data.def?.category === 'trigger'
  const first = trigger ? 1 : 0 // where the steps start in list
  // The step dragged by its grip: it follows the pointer (dy), the steps between its place (from) and where it would land
  // (to) making room for it (h, its height), until dropped.
  const [drag, setDrag] = useState(null) // { id, from, to, dy, h }
  const stepsRef = useRef()
  const steps = list.slice(first)
  // Where it lands: after the other steps whose middle is above its own; it stays between the first and last step.
  const grab = (e, id) => {
    e.preventDefault()
    const slots = [...stepsRef.current.children].map((el) => el.getBoundingClientRect())
    const from = steps.findIndex((n) => n.id === id)
    const h = slots[from].height
    let to = from
    const follow = (ev) => {
      const dy = Math.min(Math.max(ev.clientY - e.clientY, slots[0].top - slots[from].top), slots.at(-1).top - slots[from].top)
      const middle = slots[from].top + dy + h / 2
      to = slots.filter((r, k) => k !== from && r.top + r.height / 2 < middle).length
      setDrag({ id, from, to, dy, h })
    }
    const onUp = () => {
      removeEventListener('pointermove', follow)
      removeEventListener('pointerup', onUp)
      setDrag(null)
      if (to !== from) onMove(id, first + to)
    }
    addEventListener('pointermove', follow)
    addEventListener('pointerup', onUp)
    setDrag({ id, from, to, dy: 0, h })
  }
  const shift = (i) => !drag ? 0 : i === drag.from ? drag.dy
    : drag.from < i && i <= drag.to ? -drag.h : drag.to <= i && i < drag.from ? drag.h : 0
  const card = (n, i) => {
    const isTrigger = n === list[0] && trigger
    const Icon = (n.data.type === 'widget' ? n.data.widgetType : n.data.def)?.Icon ?? IconBox
    const sub = subtitle(n.data)
    return (
      <div key={n.id} className={n.className}>
        <div className={`basic-step${isTrigger ? ' trigger' : ''}${n.selected ? ' selected' : ''}${drag?.id === n.id ? ' dragging' : ''}`}
          role="button" tabIndex={0} aria-label={n.ariaLabel} onClick={() => onSelect(n.id)} onKeyDown={(e) => e.key === 'Enter' && onSelect(n.id)}>
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
              {!isTrigger && <Menu.Item leftSection={<IconArrowUp size={14} />} disabled={i === 0} onClick={() => onMove(n.id, first + i - 1)}>Move up</Menu.Item>}
              {!isTrigger && <Menu.Item leftSection={<IconArrowDown size={14} />} disabled={i === steps.length - 1} onClick={() => onMove(n.id, first + i + 1)}>Move down</Menu.Item>}
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete(n.id)}>Delete</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    )
  }
  return (
    <div className={`basic${drag ? ' sorting' : ''}`} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <Stack className="basic-list" gap={0}>
        <Title>When</Title>
        {trigger ? card(list[0]) : (
          <button className="basic-step trigger empty" onClick={onLibrary}>
            <Text size="sm" c="dimmed">Pick a trigger in the library: double-click it, or drag it here.</Text>
          </button>
        )}
        {list.length > 0 && <><Link /><Title>Then</Title></>}
        <div ref={stepsRef}>
          {steps.map((n, i) => (
            <div key={n.id} className="basic-slot" style={{ transform: shift(i) ? `translateY(${shift(i)}px)` : undefined, zIndex: drag?.id === n.id ? 1 : undefined }}>
              {card(n, i)}<Link />
            </div>
          ))}
        </div>
        {list.length > 0 && (
          <>
            <div className="basic-step add" aria-hidden><IconPlus size={20} /></div>
            <Text size="xs" c="dimmed" ta="center" mt={4}>Double-click a node in the library, or drag it here.</Text>
          </>
        )}
      </Stack>
    </div>
  )
}
