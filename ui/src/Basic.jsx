// Basic view of a one-line workflow (chain.js): its trigger under "When", its steps under "Then", and "Add step". A card
// opens the node's settings, like a click on the graph; its menu moves or deletes it; the trigger's bolt fires it. Library items dropped here are
// added at the end (a trigger at the top).
import { ActionIcon, Button, Menu, Stack, Text } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconBox, IconDots, IconPlugOff, IconPlus, IconTrash } from '@tabler/icons-react'
import { Bolt, colors, subtitle } from './FlowNode.jsx'

const Title = ({ children }) => <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md" mb={6}>{children}</Text>
const Link = () => <div className="basic-link" />

// list: the chain's nodes as the graph shows them (data with def, widget, missing; className with the run state).
// onSelect(id), onMove(id, -1 | 1), onDelete(id), onLibrary(): shows the library, onDrop(e).
export default function Basic({ list, onSelect, onMove, onDelete, onLibrary, onDrop }) {
  const trigger = list[0]?.data.def?.category === 'trigger'
  const steps = trigger ? list.slice(1) : list
  const card = (n, i) => {
    const isTrigger = n === list[0] && trigger
    const Icon = (n.data.type === 'widget' ? n.data.widgetType : n.data.def)?.Icon ?? IconBox
    const sub = subtitle(n.data)
    return (
      <div key={n.id} className={n.className}>
        <div className={`basic-step${isTrigger ? ' trigger' : ''}${n.selected ? ' selected' : ''}`} role="button" tabIndex={0}
          aria-label={n.ariaLabel} onClick={() => onSelect(n.id)} onKeyDown={(e) => e.key === 'Enter' && onSelect(n.id)}>
          {isTrigger && n.data.def?.manual && <Bolt onFire={n.data.fire} />}
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
              {!isTrigger && <Menu.Item leftSection={<IconArrowUp size={14} />} disabled={i === 0} onClick={() => onMove(n.id, -1)}>Move up</Menu.Item>}
              {!isTrigger && <Menu.Item leftSection={<IconArrowDown size={14} />} disabled={i === steps.length - 1} onClick={() => onMove(n.id, 1)}>Move down</Menu.Item>}
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete(n.id)}>Delete</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    )
  }
  return (
    <div className="basic" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <Stack className="basic-list" gap={0}>
        <Title>When</Title>
        {trigger ? card(list[0]) : (
          <button className="basic-step trigger empty" onClick={onLibrary}>
            <Text size="sm" c="dimmed">Pick a trigger in the library: double-click it, or drag it here.</Text>
          </button>
        )}
        {steps.length > 0 && <><Link /><Title>Then</Title></>}
        {steps.map((n, i) => <div key={n.id}>{i > 0 && <Link />}{card(n, i)}</div>)}
        {list.length > 0 && (
          <Stack align="center" gap={4} mt="md">
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={onLibrary}>Add step</Button>
            <Text size="xs" c="dimmed">Double-click a node in the library, or drag it here.</Text>
          </Stack>
        )}
      </Stack>
    </div>
  )
}
