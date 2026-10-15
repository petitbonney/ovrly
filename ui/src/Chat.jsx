// Chat: Twitch channel setting (sidebar) and a toolbar popover that fires fake chat messages.
import { useEffect, useState } from 'react'
import { ActionIcon, Button, ColorSwatch, Popover, Stack, TextInput, Tooltip } from '@mantine/core'
import { IconMessagePlus } from '@tabler/icons-react'
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

export function ChatTest() {
  const [user, setUser] = useState('tester')
  const [message, setMessage] = useState('!spin')

  const send = (e) => {
    e.preventDefault()
    fetch('/api/emit/chat', json('POST', { user, message, channel: 'test' }))
  }

  return (
    <Popover position="bottom-end" withArrow>
      <Popover.Target>
        <Tooltip label="Send a test chat message">
          <ActionIcon size="md" variant="default"><IconMessagePlus size={18} /></ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <form onSubmit={send}>
          <Stack gap="xs" w={220}>
            <TextInput size="xs" label="User" value={user} onChange={(e) => setUser(e.target.value)} />
            <TextInput size="xs" label="Message" value={message} onChange={(e) => setMessage(e.target.value)} data-autofocus />
            <Button size="xs" type="submit">Send</Button>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  )
}
