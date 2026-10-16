// Chat test form, in chat triggers' settings: fires fake chat messages.
import { useState } from 'react'
import { Button, Group, TextInput } from '@mantine/core'
import { IconCheck, IconSend } from '@tabler/icons-react'
import Heading from './Heading.jsx'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

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
