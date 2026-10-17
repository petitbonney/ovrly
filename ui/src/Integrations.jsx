// Sidebar "Integration" section: one row per connection (Twitch, OBS, Giphy), clicked to open its settings, with a
// status dot (green connected, red not). The settings open in a dialog; saving reconnects.
import { useEffect, useState } from 'react'
import { Anchor, Button, Code, ColorSwatch, Group, Loader, Modal, NavLink, Paper, PasswordInput, SegmentedControl, Stack, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core'
import { IconArrowUpRight, IconBrandTwitch, IconExternalLink, IconLogout } from '@tabler/icons-react'
import Heading from './Heading.jsx'
import { get, json } from './api.js'

// A connection's status, polled so the dot follows connects and disconnects.
function useStatus(path) {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    const load = () => get(path).then(setStatus, () => {})
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [path])
  return [status, setStatus]
}

// The whole row opens the settings dialog: an arrow saying so, the name, and the status dot on the right.
function Row({ name, connected, tip, onSettings }) {
  return (
    <NavLink
      component="button" // focusable and keyboard-operable (an <a> without href is neither)
      onClick={onSettings}
      aria-label={`${name} settings`}
      leftSection={<IconArrowUpRight size={14} color="var(--mantine-color-dimmed)" />}
      label={name}
      rightSection={
        <Tooltip label={tip}>
          <ColorSwatch size={8} withShadow={false} color={connected ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-red-8)'} />
        </Tooltip>
      }
    />
  )
}

// A settings dialog: its fields, the status, and a Connect button that saves (none without onSave).
function Settings({ title, opened, onClose, onSave, status, children }) {
  const save = (e) => {
    e.preventDefault()
    onSave?.()
  }
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <form onSubmit={save}>
        <Stack gap="sm">
          {children}
          <Text size="xs" c={status.connected ? 'green' : 'dimmed'}>{status.text}</Text>
          {onSave && <Group justify="end"><Button size="xs" type="submit">Connect</Button></Group>}
        </Stack>
      </form>
    </Modal>
  )
}

// Streamer sign-in: signed in as… (or asked to sign in again for new permissions), the code to approve while
// pending, or a sign-in button.
function TwitchAccount({ account, setStatus }) {
  const call = async (method, path = '/api/twitch/login') => {
    const res = await fetch(path, { method })
    res.ok ? setStatus(await res.json()) : setStatus((s) => ({ ...s, account: { ...s.account, error: 'Cannot reach Twitch' } }))
  }
  // Twitch's own purple, so the button reads as "sign in with Twitch" at a glance.
  const twitchButton = (label) => (
    <Button color="#9146ff" leftSection={<IconBrandTwitch size={18} />} onClick={() => call('POST')}>{label}</Button>
  )
  if (account?.device) return (
    <Stack gap="xs" align="center" ta="center">
      <Text size="xs" c="dimmed">Check that Twitch shows this code, then approve:</Text>
      <Code fz="xl" fw={700} px="md" py={6} style={{ letterSpacing: '0.2em' }}>{account.device.code}</Code>
      <Button component="a" href={account.device.uri} target="_blank" color="#9146ff" leftSection={<IconExternalLink size={16} />}>
        Open twitch.tv/activate
      </Button>
      <Group gap={6}>
        <Loader size={12} />
        <Text size="xs" c="dimmed">Waiting for approval…</Text>
        <Anchor size="xs" component="button" type="button" onClick={() => call('POST', '/api/twitch/login/cancel')}>Cancel</Anchor>
      </Group>
    </Stack>
  )
  // The signed-in account as a card: Twitch badge, login, and Sign out on the right.
  if (account?.login) return (
    <Stack gap="xs">
      <Paper withBorder radius="md" p="sm">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={36} radius="xl" color="#9146ff"><IconBrandTwitch size={20} /></ThemeIcon>
          <Stack gap={0} flex={1} miw={0}>
            <Text size="sm" fw={600} truncate>{account.login}</Text>
            <Text size="xs" c="dimmed">Signed in as streamer</Text>
          </Stack>
          <Tooltip label="Signs out and removes Ovrly's access to your Twitch account">
            <Button size="xs" variant="light" color="red" leftSection={<IconLogout size={14} />} onClick={() => call('DELETE')}>Sign out</Button>
          </Tooltip>
        </Group>
      </Paper>
      {!account.scopesOk && <Text size="xs" c="yellow">Ovrly needs more permissions: sign in again to allow them.</Text>}
      {!account.scopesOk && twitchButton('Sign in again with Twitch')}
    </Stack>
  )
  return (
    <Stack gap={4}>
      {twitchButton('Sign in with Twitch')}
      {account?.error && <Text size="xs" c="red">{account.error}</Text>}
    </Stack>
  )
}

const modes = [
  { value: 'guest', label: 'Guest' },
  { value: 'streamer', label: 'Streamer' },
]

// Twitch dialog: Guest reads any channel's chat with no sign-in; Streamer signs in as the channel owner, which the
// Twitch features of nodes and widgets (polls, predictions…) need.
function Twitch() {
  const [status, setStatus] = useStatus('/api/twitch')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ mode: 'guest', channel: '' })
  const edit = () => {
    setForm({ mode: status?.mode ?? 'guest', channel: status?.guestChannel ?? '' })
    setOpen(true)
  }
  const save = async (settings) => setStatus(await (await fetch('/api/twitch', json('PUT', settings))).json())
  // Switching modes applies at once (with the saved channel); in Guest mode, Connect saves a new channel.
  const switchMode = (mode) => {
    setForm({ ...form, mode })
    save({ mode, channel: status?.guestChannel ?? '' })
  }
  const ok = status?.connected && (status.mode === 'guest' || status.eventsub?.connected)
  const tip = status?.mode === 'streamer' && !status.account?.login ? 'Streamer mode: sign in to Twitch'
    : !status?.channel ? 'No channel set'
    : !status.connected ? `Connecting to #${status.channel}…`
    : status.mode === 'streamer' && !status.eventsub?.connected ? `Chat of #${status.channel}; Twitch events: ${status.eventsub?.error || 'connecting…'}`
    : `Connected to #${status.channel}${status.mode === 'streamer' ? ' as streamer' : ''}`
  return (
    <>
      <Row name="Twitch" connected={ok} tip={tip} onSettings={edit} />
      <Settings title="Twitch" opened={open} onClose={() => setOpen(false)} onSave={form.mode === 'guest' ? () => save(form) : undefined}
        status={{ connected: ok, text: tip }}>
        <SegmentedControl size="xs" fullWidth data={modes} value={form.mode} onChange={switchMode} />
        {form.mode === 'guest' ? (
          <>
            <Text size="xs" c="dimmed">Reads the chat of any channel, without signing in: enough for chat triggers, chat votes and chat bets.</Text>
            <TextInput size="xs" label="Channel" placeholder="channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} data-autofocus />
          </>
        ) : (
          <>
            <Text size="xs" c="dimmed">Sign in as the channel owner: reads your chat and unlocks Twitch features, like Twitch polls and predictions in the Poll and Bets widgets.</Text>
            <TwitchAccount account={status?.account} setStatus={setStatus} />
          </>
        )}
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

function Giphy() {
  const [status, setStatus] = useStatus('/api/giphy')
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const edit = () => {
    setKey(status?.key ?? '')
    setOpen(true)
  }
  const save = async () => setStatus(await (await fetch('/api/giphy', json('PUT', { key }))).json())
  const tip = status?.connected ? 'API key accepted' : status?.error || 'Checking…'
  return (
    <>
      <Row name="Giphy" connected={status?.connected} tip={tip} onSettings={edit} />
      <Settings title="Giphy" opened={open} onClose={() => setOpen(false)} onSave={save} status={{ connected: status?.connected, text: tip }}>
        <Text size="xs" c="dimmed">
          Create an app of type API at <Anchor size="xs" href="https://developers.giphy.com/dashboard/" target="_blank">developers.giphy.com</Anchor>, then paste its API key.
        </Text>
        <PasswordInput size="xs" label="API key" value={key} onChange={(e) => setKey(e.target.value)} data-autofocus />
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
      <Giphy />
    </Stack>
  )
}
