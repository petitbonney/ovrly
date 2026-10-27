// Myinstants picker dialog: trending sounds, or search results (loaded through the server, which reads the site's pages), each with a preview.
import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'

export default function MyinstantsPicker({ opened, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [sounds, setSounds] = useState([])
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState('') // url of the preview playing
  const audio = useRef(null)
  const page = useRef(1) // the last page loaded
  const latest = useRef(0) // the last load asked: an earlier one answering after it is dropped

  const load = async (query, n) => {
    const call = ++latest.current
    const res = await fetch(`/api/myinstants/search?q=${encodeURIComponent(query)}&page=${n}`)
    const body = await res.json()
    if (call !== latest.current) return
    if (!res.ok) return setError(body.error)
    setError('')
    page.current = n
    setSounds((old) => (n > 1 ? [...old, ...body] : body))
    setMore(body.length > 0)
  }

  // Searches as you type, after a short pause.
  useEffect(() => {
    if (!opened) return
    const timer = setTimeout(() => load(q.trim(), 1), 300)
    return () => clearTimeout(timer)
  }, [q, opened])

  const stop = () => {
    audio.current?.pause()
    setPlaying('')
  }
  useEffect(() => stop, [opened])
  const preview = (url) => {
    stop()
    if (url === playing) return
    audio.current = new Audio(url)
    audio.current.onended = () => setPlaying('')
    audio.current.play().catch(() => setPlaying(''))
    setPlaying(url)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Pick a sound" size="lg">
      <TextInput size="xs" placeholder="Search Myinstants" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus mb="sm" />
      {error && <Text size="xs" c="red">{error}</Text>}
      <Stack gap={4}>
        {sounds.map((s) => (
          <Group key={s.id} gap="xs" wrap="nowrap">
            <ActionIcon variant="default" aria-label={playing === s.url ? 'Stop' : `Preview ${s.title}`} onClick={() => preview(s.url)}>
              {playing === s.url ? <IconPlayerStop size={14} /> : <IconPlayerPlay size={14} />}
            </ActionIcon>
            <Text size="sm" truncate style={{ flex: 1 }}>{s.title}</Text>
            <Button size="compact-xs" variant="light" onClick={() => { onPick(s.url); onClose() }}>Pick</Button>
          </Group>
        ))}
      </Stack>
      {!sounds.length && !error && <Text size="xs" c="dimmed">No sound found</Text>}
      <Text size="xs" c="dimmed" mt="sm">Sounds from myinstants.com</Text>
      {more && <Button size="xs" variant="default" mt="xs" onClick={() => load(q.trim(), page.current + 1)}>Load more</Button>}
    </Modal>
  )
}
