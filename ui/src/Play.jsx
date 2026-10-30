// Play in an action node's settings (node types with `play`): runs the node once now, outside any workflow run and with
// no data (only {{ $vars }} fill), and shows what it added: the media it found played, links, JSON. Switch Scene, when
// it switches back after a while, gets Stop (switches back at once); a Hue routine gets Stop (with a fade) and Cancel,
// which also end a routine a workflow run plays (running).
import { useState } from 'react'
import { Anchor, Box, Button, Code, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconPlayerPlay, IconPlayerStop, IconX } from '@tabler/icons-react'
import { json } from './api.js'

// Values shown as media, by their key.
const media = { gif: 'img', sticker: 'img', avatar: 'img', thumbnail: 'img', sound: 'audio', clip: 'video' }

// A value of the result: media, a link, JSON or text (also in a trigger's Fire, Fire.jsx).
export function Value({ name, value }) {
  if (Array.isArray(value) && value.length && value.every((v) => typeof v !== 'object')) return <Text size="xs">{value.join(', ')}</Text>
  if (value && typeof value === 'object') return <Code block mah={240} style={{ overflow: 'auto' }}>{JSON.stringify(value, null, 2)}</Code>
  if (value === '') return <Text size="xs" c="dimmed">Empty</Text>
  const Media = media[name]
  if (Media) return <Media src={value} controls={Media !== 'img'} style={{ display: 'block', maxWidth: '100%', maxHeight: 160 }} />
  if (/^https?:\/\//.test(value)) return <Anchor size="xs" href={value} target="_blank" display="block" truncate>{value}</Anchor>
  return <Text size="xs">{String(value)}</Text>
}

export default function Play({ workflow, node, type, config, disabled, running }) {
  const path = `/api/nodes/${workflow}/${node}`
  const [playing, setPlaying] = useState(false)
  const [result, setResult] = useState(null) // { out, error, at }
  const play = async () => {
    setPlaying(true)
    const answer = await fetch(`${path}/play`, json('POST', { type, config }))
      .then((res) => (res.ok ? res.json() : { error: res.statusText }), (err) => ({ error: err.message }))
    setResult({ ...answer, at: new Date() })
    setPlaying(false)
  }
  const post = (url) => fetch(url, { method: 'POST' })
  const routine = type === 'hue' && config.mode === 'routine'
  const stops = routine ? (
    <>
      <Tooltip label="Ends the routine with a fade, lights back as they were: the workflow goes on">
        <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} disabled={!running && !playing}
          onClick={() => post(`/api/hue/routines/${workflow}/${node}/stop`)}>Stop</Button>
      </Tooltip>
      <Tooltip label="Ends the routine at once, lights back as they were: the workflow stops there">
        <Button size="xs" variant="default" leftSection={<IconX size={14} />} disabled={!running && !playing}
          onClick={() => post(`/api/hue/routines/${workflow}/${node}/cancel`)}>Cancel</Button>
      </Tooltip>
    </>
  ) : type === 'obs-scene' && config.back > 0 && (
    <Tooltip label="Switches back now">
      <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} disabled={!playing} onClick={() => post(`${path}/stop`)}>Stop</Button>
    </Tooltip>
  )
  // HTTP Request's response shows parsed, as json, when it is JSON.
  const added = Object.entries(result?.out ?? {}).filter(([k]) => !(k === 'response' && result.out.json !== undefined))
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Button size="xs" leftSection={<IconPlayerPlay size={14} />} loading={playing} disabled={disabled} onClick={play}>Play</Button>
        {stops}
      </Group>
      <Text size="xs" c="dimmed">
        {routine && running && !playing ? 'The routine is playing.' : 'Runs this node once now, with no data: placeholders other than {{ $vars }} are empty.'}
      </Text>
      {result && (
        <Stack gap={6}>
          <Text size="xs" fw={500}>Result <Text span inherit c="dimmed" fw={400}>· {result.at.toLocaleTimeString()}</Text></Text>
          {result.error ? <Text size="xs" c="red">{result.error}</Text>
            : !result.out ? <Text size="xs" c="dimmed">Stopped</Text>
            : !added.length ? <Text size="xs" c="dimmed">Done</Text>
            : added.map(([k, v]) => (
              <Group key={k} gap="xs" wrap="nowrap" align="flex-start">
                <Text size="xs" c="dimmed" ff="monospace" w={110} style={{ flexShrink: 0 }} truncate>{`{{${k}}}`}</Text>
                <Box flex={1} miw={0}><Value name={k} value={v} /></Box>
              </Group>
            ))}
        </Stack>
      )}
    </Stack>
  )
}
