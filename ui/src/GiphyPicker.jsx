// Giphy picker dialog: trending GIFs, or the results of a search, loaded through the server (the API key stays there).
import { useEffect, useState } from 'react'
import { Button, Image, Modal, SimpleGrid, Text, TextInput, UnstyledButton } from '@mantine/core'

export default function GiphyPicker({ opened, onClose, onPick, media = 'gif', rating }) {
  const [q, setQ] = useState('')
  const [gifs, setGifs] = useState([])
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  const load = async (query, offset) => {
    const res = await fetch(`/api/giphy/search?q=${encodeURIComponent(query)}&offset=${offset}&kind=${media}&rating=${rating ?? 'pg'}`)
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    setError('')
    setGifs((old) => (offset ? [...old, ...body] : body))
    setMore(body.length > 0)
  }

  // Searches as you type, after a short pause.
  useEffect(() => {
    if (!opened) return
    const timer = setTimeout(() => load(q.trim(), 0), 300)
    return () => clearTimeout(timer)
  }, [q, opened, media, rating])

  return (
    <Modal opened={opened} onClose={onClose} title={`Pick a ${media === 'gif' ? 'GIF' : media}`} size="lg">
      <TextInput size="xs" placeholder={`Search Giphy ${media === 'gif' ? 'GIFs' : media + 's'} (empty: trending)`} value={q} onChange={(e) => setQ(e.target.value)} data-autofocus mb="sm" />
      {error && <Text size="xs" c="red">{error}</Text>}
      <SimpleGrid cols={4} spacing="xs">
        {gifs.map((g) => (
          <UnstyledButton key={g.id} aria-label={g.title || 'GIF'} onClick={() => { onPick(g.url); onClose() }}>
            <Image src={g.preview} alt={g.title} h={90} fit="cover" radius="sm" />
          </UnstyledButton>
        ))}
      </SimpleGrid>
      <Text size="xs" c="dimmed" mt="sm">Powered by GIPHY</Text>
      {more && <Button size="xs" variant="default" mt="xs" onClick={() => load(q.trim(), gifs.length)}>Load more</Button>}
    </Modal>
  )
}
