// What a node holds now, shown in its settings (node types with `live`): a Cooldown's cooldowns running (a cross drops
// one), a Delay's firings waiting and a Fan In's list filling (with Force and Cancel). Refreshed every second.
import { useEffect, useState } from 'react'
import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconPlayerTrackNext, IconX } from '@tabler/icons-react'
import { get, json } from './api.js'

// What a firing carries, in short: "bob: !spin" for chat, else its data as JSON (also a Queue's line).
export const summary = (data) => (data?.user && data.message ? `${data.user}: ${data.message}` : typeof data === 'string' ? data : JSON.stringify(data))
const time = (ms) => `${Math.ceil(ms / 1000)}s`

// One line: what, and on the right the time left (or anything short), then a cross when onDrop is given.
const Row = ({ label, right, onDrop }) => (
  <Group gap={6} wrap="nowrap">
    <Text size="xs" flex={1} truncate>{label}</Text>
    <Text size="xs" c="dimmed">{right}</Text>
    {onDrop && (
      <Tooltip label="Drop this cooldown: the next data goes through">
        <ActionIcon variant="subtle" color="red" size="sm" onClick={onDrop} aria-label="Drop"><IconX size={14} /></ActionIcon>
      </Tooltip>
    )}
  </Group>
)
// Force and Cancel, as in a Wait For All's settings (JoinLinks.jsx); force and cancel say what each does.
const End = ({ act, disabled, force, cancel }) => (
  <Group gap="xs" mt="xs">
    <Tooltip label={force}>
      <Button size="xs" variant="default" leftSection={<IconPlayerTrackNext size={14} />} disabled={disabled} onClick={() => act('force')}>Force</Button>
    </Tooltip>
    <Tooltip label={cancel}>
      <Button size="xs" variant="default" leftSection={<IconX size={14} />} disabled={disabled} onClick={() => act('cancel')}>Cancel</Button>
    </Tooltip>
  </Group>
)
const Empty = ({ children }) => <Text size="xs" c="dimmed">{children}</Text>

function Cooldown({ state, config, act }) {
  return (
    <>
      <Row label="Global cooldown" right={state.left > 0 ? `${time(state.left)} left` : 'Ready'} onDrop={state.left > 0 && (() => act('drop'))} />
      {config.byKey && (
        <>
          <Text size="xs" fw={500} mt="xs">Per key</Text>
          {state.keys.length === 0 && <Empty>None: every {config.key} can go through</Empty>}
          {state.keys.map((k) => <Row key={k.key} label={k.key} right={`${time(k.left)} left`} onDrop={() => act('drop', k.key)} />)}
        </>
      )}
    </>
  )
}

const Delay = ({ state, act }) => (
  <>
    {state.length === 0 && <Empty>Nothing waiting</Empty>}
    {state.map((w, i) => <Row key={i} label={summary(w.data)} right={`${time(w.left)} left`} />)}
    <End act={act} disabled={!state.length} force="Goes on now, without waiting" cancel="Drops what's waiting: the workflow stops there" />
  </>
)

const FanIn = ({ state, act }) => (
  <>
    {state ? (
      <>
        <Row label={`${state.items.length} collected`} right={state.left == null ? 'Released at the limit' : `Released in ${time(state.left)}`} />
        {state.items.map((item, i) => <Text key={i} size="xs" c="dimmed" truncate>{summary(item)}</Text>)}
      </>
    ) : <Empty>Empty: the next firing starts a new list</Empty>}
    <End act={act} disabled={!state} force="Releases the list now" cancel="Drops the list: the workflow stops there" />
  </>
)

const views = { cooldown: [Cooldown, 'Cooldowns'], delay: [Delay, 'Waiting'], 'fan-in': [FanIn, 'Collecting'] }

export default function NodeLive({ workflow, node, type, config }) {
  const path = `/api/nodes/${workflow}/${node}/live`
  const [state, setState] = useState()
  const load = () => get(`${path}?type=${type}`).then(setState, () => {})
  const act = (action, key) => fetch(path, json('POST', { type, action, key })).then(load)
  useEffect(() => {
    load()
    const timer = setInterval(load, 1000)
    return () => clearInterval(timer)
  }, [path, type])
  const [View, title] = views[type]
  return (
    <Stack gap={4} maw={420} mt="sm">
      <Text size="xs" fw={500}>{title}</Text>
      {state !== undefined && <View state={state} config={config} act={act} />}
    </Stack>
  )
}
