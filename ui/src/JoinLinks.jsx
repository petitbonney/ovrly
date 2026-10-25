// A Wait For All node's incoming links, shown in its settings: which have delivered, and Force (continue now with what
// arrived) and Cancel (the firings waiting there stop). Refreshed every second.
import { useEffect, useState } from 'react'
import { Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconClock, IconPlayerTrackNext, IconX } from '@tabler/icons-react'
import { get } from './api.js'

// links: [{ id, name }], the node's incoming links and the name of the node each comes from.
export default function JoinLinks({ workflow, node, links }) {
  const path = `/api/joins/${workflow}/${node}`
  const [arrived, setArrived] = useState([])
  const load = () => get(path).then(setArrived, () => {})
  useEffect(() => {
    load()
    const timer = setInterval(load, 1000)
    return () => clearInterval(timer)
  }, [path])
  const end = (how) => fetch(`${path}/${how}`, { method: 'POST' }).then(load)
  return (
    <Stack gap={4} maw={420} mt="sm">
      <Text size="xs" fw={500}>Links</Text>
      {links.length === 0 && <Text size="xs" c="dimmed">None yet: link nodes into this one</Text>}
      {links.map((l) => (
        <Group key={l.id} gap={6} wrap="nowrap">
          {arrived.includes(l.id) ? <IconCheck size={14} color="var(--mantine-color-green-6)" /> : <IconClock size={14} color="var(--mantine-color-dimmed)" />}
          <Text size="xs" flex={1} truncate>{l.name}</Text>
          <Text size="xs" c="dimmed">{arrived.includes(l.id) ? 'Arrived' : 'Waiting'}</Text>
        </Group>
      ))}
      <Group gap="xs" mt="xs">
        <Tooltip label="Continues now with the data that arrived">
          <Button size="xs" variant="default" leftSection={<IconPlayerTrackNext size={14} />} disabled={!arrived.length} onClick={() => end('force')}>Force</Button>
        </Tooltip>
        <Tooltip label="Drops the data that arrived: the workflow stops there">
          <Button size="xs" variant="default" leftSection={<IconX size={14} />} disabled={!arrived.length} onClick={() => end('cancel')}>Cancel</Button>
        </Tooltip>
      </Group>
    </Stack>
  )
}
