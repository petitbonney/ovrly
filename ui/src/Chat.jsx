// Chat: Twitch channel setting (sidebar) and a test form, in chat triggers' settings, that fires fake chat messages.
import { useEffect, useState } from 'react'
import { Button, ColorSwatch, Group, Stack, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconSend } from '@tabler/icons-react'
import Heading from './Heading.jsx'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function Twitch() {
  const [status, setStatus] = useState({ channel: '', connected: false })
  const [channel, setChannel] = useState('')
  useEffect(() => {
    // Polled so the dot follows connect/disconnect without a WebSocket yet.
    const load = () => fetch('/api/twitch').then((r) => r.json()).then(setStatus)
    fetch('/api/twitch').then((r) => r.json()).then((s) => { setStatus(s); setChannel(s.channel) })
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setStatus(await (await fetch('/api/twitch', json('PUT', { channel }))).json())
  }

  return (
    <form onSubmit={save}>
      <Heading title="Twitch">
        <Tooltip label={status.connected ? `Connected to #${status.channel}` : 'Disconnected'}>
          <ColorSwatch size={8} withShadow={false} color={status.connected ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-red-8)'} />
        </Tooltip>
      </Heading>
      <Stack gap="xs">
        <TextInput size="xs" placeholder="channel" value={channel} onChange={(e) => setChannel(e.target.value)} />
        <Button size="xs" variant="default" type="submit">Connect</Button>
      </Stack>
    </form>
  )
}

// Test form in a chat trigger's settings: fires a fake chat message, as if someone typed it on Twitch.
export function ChatTest({ message: initial }) {
  const [user, setUser] = useState('tester')
  const [message, setMessage] = useState(initial)
  const [sent, setSent] = useState(false)

  const send = async (e) => {
    e.preventDefault()
    await fetch('/api/emit/chat', json('POST', { user, message, channel: 'test' }))
    setSent(true)
    setTimeout(() => setSent(false), 1500)
  }

  return (
    <form onSubmit={send}>
      <Heading title="Test" />
      <Group gap="xs">
        <TextInput size="xs" w={110} placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} />
        <TextInput size="xs" w={200} placeholder="message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button size="xs" variant="default" type="submit" leftSection={sent ? <IconCheck size={14} /> : <IconSend size={14} />}>
          {sent ? 'Sent' : 'Send chat message'}
        </Button>
      </Group>
    </form>
  )
}
