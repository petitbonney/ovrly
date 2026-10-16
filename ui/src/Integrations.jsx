// Sidebar "Integration" section: one row per connection (Twitch chat, OBS) with a settings button, its name and a
// status dot (green connected, red not). The settings open in a dialog; saving reconnects.
import { useEffect, useState } from 'react'
import { ActionIcon, Button, ColorSwatch, Group, Modal, PasswordInput, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import Heading from './Heading.jsx'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// A connection's status, polled so the dot follows connects and disconnects.
function useStatus(path) {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    const load = () => fetch(path).then((r) => r.json()).then(setStatus, () => {})
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [path])
  return [status, setStatus]
}

function Row({ name, connected, tip, onSettings }) {
  return (
    <Group gap="xs" wrap="nowrap" py={2}>
      <Tooltip label={`${name} settings`}>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onSettings} aria-label={`${name} settings`}><IconSettings size={16} /></ActionIcon>
      </Tooltip>
      <Text size="sm" flex={1}>{name}</Text>
      <Tooltip label={tip}>
        <ColorSwatch size={8} withShadow={false} color={connected ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-red-8)'} />
      </Tooltip>
    </Group>
  )
}

// A settings dialog: its fields, the status, and a Connect button that saves.
function Settings({ title, opened, onClose, onSave, status, children }) {
  const save = (e) => {
    e.preventDefault()
    onSave()
  }
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <form onSubmit={save}>
        <Stack gap="sm">
          {children}
          <Text size="xs" c={status.connected ? 'green' : 'dimmed'}>{status.text}</Text>
          <Group justify="end"><Button size="xs" type="submit">Connect</Button></Group>
        </Stack>
      </form>
    </Modal>
  )
}

function Twitch() {
  const [status, setStatus] = useStatus('/api/twitch')
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState('')
  const edit = () => {
    setChannel(status?.channel ?? '')
    setOpen(true)
  }
  const save = async () => setStatus(await (await fetch('/api/twitch', json('PUT', { channel }))).json())
  const tip = status?.connected ? `Connected to #${status.channel}` : status?.channel ? `Connecting to #${status.channel}…` : 'No channel set'
  return (
    <>
      <Row name="Twitch" connected={status?.connected} tip={tip} onSettings={edit} />
      <Settings title="Twitch" opened={open} onClose={() => setOpen(false)} onSave={save} status={{ connected: status?.connected, text: tip }}>
        <TextInput size="xs" label="Channel" description="The chat to read, e.g. your channel name" placeholder="channel" value={channel} onChange={(e) => setChannel(e.target.value)} data-autofocus />
      </Settings>
    </>
  )
}

function Obs() {
  const [status, setStatus] = useStatus('/api/obs')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ url: '', password: '' })
  const edit = () => {
    setForm({ url: status?.url ?? '', password: status?.password ?? '' })
    setOpen(true)
  }
  const save = async () => setStatus(await (await fetch('/api/obs', json('PUT', form))).json())
  const tip = status?.connected ? `Connected to ${status.url}` : status?.url ? `Not connected: ${status.error || 'connecting…'}` : 'No URL set'
  return (
    <>
      <Row name="OBS" connected={status?.connected} tip={tip} onSettings={edit} />
      <Settings title="OBS" opened={open} onClose={() => setOpen(false)} onSave={save} status={{ connected: status?.connected, text: tip }}>
        <Text size="xs" c="dimmed">In OBS: Tools → WebSocket Server Settings. Turn the server on, then copy its port and password.</Text>
        <TextInput size="xs" label="WebSocket URL" placeholder="ws://localhost:4455" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} data-autofocus />
        <PasswordInput size="xs" label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Settings>
    </>
  )
}

export default function Integrations() {
  return (
    <Stack gap={0}>
      <Heading title="Integration" />
      <Twitch />
      <Obs />
    </Stack>
  )
}
