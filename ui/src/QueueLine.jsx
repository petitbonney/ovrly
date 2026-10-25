// A Queue node's waiting line, shown in its settings: each firing waiting (first in line first), with how long it has
// waited and what it carries, and a button to remove it (that firing stops there). Refreshed every second.
import { useEffect, useState } from 'react'
import { ActionIcon, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { get } from './api.js'
import { summary } from './NodeLive.jsx'

export default function QueueLine({ workflow, node }) {
  const path = `/api/queues/${workflow}/${node}`
  const [line, setLine] = useState([])
  const load = () => get(path).then(setLine, () => {})
  useEffect(() => {
    load()
    const timer = setInterval(load, 1000)
    return () => clearInterval(timer)
  }, [path])
  const remove = (id) => fetch(`${path}/${id}`, { method: 'DELETE' }).then(load)
  return (
    <Stack gap={4} mt="sm">
      <Text size="xs" fw={500}>Waiting in line</Text>
      {line.length === 0 && <Text size="xs" c="dimmed">Nobody: the next firing goes straight through</Text>}
      {line.map((entry, i) => (
        <Group key={entry.id} gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" w={18}>{i + 1}.</Text>
          <Text size="xs" flex={1} truncate>{summary(entry.data)}</Text>
          <Text size="xs" c="dimmed">{Math.round((Date.now() - entry.at) / 1000)}s</Text>
          <Tooltip label="Remove from the line: this firing stops here">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(entry.id)} aria-label="Remove"><IconX size={14} /></ActionIcon>
          </Tooltip>
        </Group>
      ))}
    </Stack>
  )
}
