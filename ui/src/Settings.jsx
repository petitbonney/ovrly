// Settings dialog: a left column of sections (Integration, Network) like the node library, and the pane of the
// clicked item on the right. Integrations show a status dot (green connected, red not); saving reconnects.
import { useEffect, useState } from 'react'
import { Anchor, Button, Code, ColorSwatch, Group, Loader, Modal, NavLink, Paper, PasswordInput, SegmentedControl, Stack, Switch, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core'
import { IconBrandTwitch, IconExternalLink, IconLogout } from '@tabler/icons-react'
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

// A pane's fields, the status, and a Connect button that saves (none without onSave).
function Pane({ onSave, status, children }) {
  const save = (e) => {
    e.preventDefault()
    onSave?.()
  }
  return (
    <form onSubmit={save}>
      <Stack gap="sm">
        {children}
        <Text size="xs" c={status.connected ? 'green' : 'dimmed'}>{status.text}</Text>
        {onSave && <Group justify="end"><Button size="xs" type="submit">Connect</Button></Group>}
      </Stack>
    </form>
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

// What each integration's dot and pane say, from its status.
const twitchInfo = (status) => ({
  connected: status?.connected && (status.mode === 'guest' || status.eventsub?.connected),
  text: status?.mode === 'streamer' && !status.account?.login ? 'Streamer mode: sign in to Twitch'
    : !status?.channel ? 'No channel set'
    : !status.connected ? `Connecting to #${status.channel}…`
    : status.mode === 'streamer' && !status.eventsub?.connected ? `Chat of #${status.channel}; Twitch events: ${status.eventsub?.error || 'connecting…'}`
    : `Connected to #${status.channel}${status.mode === 'streamer' ? ' as streamer' : ''}`,
})
const obsInfo = (status) => ({
  connected: status?.connected,
  text: status?.connected ? `Connected to ${status.url}` : status?.url ? `Not connected: ${status.error || 'connecting…'}` : 'No URL set',
})
const streamdeckInfo = (status) => ({
  connected: status?.connected,
  text: status?.connected ? `Plugin connected: ${status.keys.length} key${status.keys.length === 1 ? '' : 's'} paired` : 'Plugin not connected: is the Stream Deck app running, with the Ovrly plugin?',
})
const giphyInfo = (status) => ({
  connected: status?.connected,
  text: status?.connected ? 'API key accepted' : status?.error || 'Checking…',
})

// Twitch: Guest reads any channel's chat with no sign-in; Streamer signs in as the channel owner, which the
// Twitch features of nodes and widgets (polls, predictions…) need.
function Twitch({ status, setStatus }) {
  const [form, setForm] = useState({ mode: status.mode ?? 'guest', channel: status.guestChannel ?? '' })
  const save = async (settings) => setStatus(await (await fetch('/api/twitch', json('PUT', settings))).json())
  // Switching modes applies at once (with the saved channel); in Guest mode, Connect saves a new channel.
  const switchMode = (mode) => {
    setForm({ ...form, mode })
    save({ mode, channel: status.guestChannel ?? '' })
  }
  return (
    <Pane onSave={form.mode === 'guest' ? () => save(form) : undefined} status={twitchInfo(status)}>
      <SegmentedControl size="xs" fullWidth data={modes} value={form.mode} onChange={switchMode} />
      {form.mode === 'guest' ? (
        <>
          <Text size="xs" c="dimmed">Reads the chat of any channel, without signing in: enough for chat triggers and chat votes.</Text>
          <TextInput size="xs" label="Channel" placeholder="channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} data-autofocus />
        </>
      ) : (
        <>
          <Text size="xs" c="dimmed">Sign in as the channel owner: reads your chat and unlocks Twitch features: EventSub triggers, Twitch actions, and Twitch polls and predictions in the Voting widget.</Text>
          <TwitchAccount account={status.account} setStatus={setStatus} />
        </>
      )}
    </Pane>
  )
}

function Obs({ status, setStatus }) {
  const [form, setForm] = useState({ url: status.url ?? '', password: status.password ?? '' })
  const save = async () => setStatus(await (await fetch('/api/obs', json('PUT', form))).json())
  return (
    <Pane onSave={save} status={obsInfo(status)}>
      <Text size="xs" c="dimmed">In OBS: Tools → WebSocket Server Settings. Turn the server on, then copy its port and password.</Text>
      <TextInput size="xs" label="WebSocket URL" placeholder="ws://localhost:4455" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} data-autofocus />
      <PasswordInput size="xs" label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
    </Pane>
  )
}

function Giphy({ status, setStatus }) {
  const [key, setKey] = useState(status.key ?? '')
  const save = async () => setStatus(await (await fetch('/api/giphy', json('PUT', { key }))).json())
  return (
    <Pane onSave={save} status={giphyInfo(status)}>
      <Text size="xs" c="dimmed">
        Create an app of type API at <Anchor size="xs" href="https://developers.giphy.com/dashboard/" target="_blank">developers.giphy.com</Anchor>, then paste its API key.
      </Text>
      <PasswordInput size="xs" label="API key" value={key} onChange={(e) => setKey(e.target.value)} data-autofocus />
    </Pane>
  )
}

// Stream Deck: the Ovrly plugin (in streamdeck/) shows Control Pad node buttons on keys and fires them. It connects by
// itself, so there is nothing to set here: how to install it, and the devices it sees.
function StreamDeck({ status }) {
  return (
    <Pane status={streamdeckInfo(status)}>
      <Text size="xs" c="dimmed">
        Needs the Stream Deck app 7.1 or later. Download the Ovrly plugin and open it to install it (from source, run
        {' '}<Code>pnpm streamdeck:pack</Code> first). Then, in the Stream Deck app, drag Ovrly → Ovrly button onto a key and pick
        one of your Control Pad node buttons in its settings: the key shows it, live, and fires it.
      </Text>
      <Button size="xs" variant="light" component="a" href="/streamdeck/com.ovrly.deck.streamDeckPlugin" download style={{ alignSelf: 'start' }}>Download the plugin</Button>
      {Object.entries(status.devices).map(([id, d]) => (
        <Text key={id} size="xs">{d.name}: {d.columns} × {d.rows} keys, {status.keys.filter((k) => k.device === id).length} paired</Text>
      ))}
    </Pane>
  )
}

// Network: by default only this computer reaches Ovrly; "Open to LAN" lets other devices on the network (a second PC
// running OBS, a phone) open the UI and the widget links.
function Network({ status, setStatus }) {
  const toggle = async (lan) => setStatus(await (await fetch('/api/network', json('PUT', { lan }))).json())
  return (
    <Stack gap="sm">
      <Switch
        label="Open to LAN"
        description="Lets other devices on your network open Ovrly, including its widget links in OBS on another computer. Anyone on that network can then use it and edit your workflows."
        checked={status.lan} onChange={(e) => toggle(e.currentTarget.checked)}
      />
      {status.lan && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Reachable at:</Text>
          {status.addresses.length ? status.addresses.map((a) => <Code key={a}>{`http://${a}:${status.port}`}</Code>) : <Text size="xs" c="dimmed">No network found</Text>}
        </Stack>
      )}
    </Stack>
  )
}

// Integration key -> its label, status and pane. A node lists the keys it `needs`; `ready` says from the status
// whether it can run, `needs` is the note shown when it can't.
export const integrations = [
  { key: 'twitch', label: 'Twitch', path: '/api/twitch', info: twitchInfo, Pane: Twitch, ready: (s) => s.streamer, needs: 'Twitch in Streamer mode, signed in' },
  { key: 'obs', label: 'OBS', path: '/api/obs', info: obsInfo, Pane: Obs, ready: (s) => s.connected, needs: 'OBS connected' },
  { key: 'streamdeck', label: 'Stream Deck', path: '/api/streamdeck', info: streamdeckInfo, Pane: StreamDeck, ready: (s) => s.connected, needs: 'the Ovrly Stream Deck plugin connected' },
  { key: 'giphy', label: 'Giphy', path: '/api/giphy', info: giphyInfo, Pane: Giphy, ready: (s) => s.connected, needs: 'Giphy connected (API key)' },
]

export default function Settings({ opened, onClose }) {
  const [item, setItem] = useState('twitch')
  const states = Object.fromEntries(integrations.map((i) => [i.key, useStatus(i.path)])) // fixed list, so hook order is stable
  const [network, setNetwork] = useStatus('/api/network')
  const current = integrations.find((i) => i.key === item)
  const status = current ? states[current.key][0] : network
  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="xl">
      <Group align="stretch" gap="md" wrap="nowrap" mih={340}>
        <Stack gap={0} w={180} pr="md" style={{ borderRight: '1px solid var(--mantine-color-dark-4)', flexShrink: 0 }}>
          <Heading title="Integration" />
          {integrations.map((i) => {
            const { connected, text } = i.info(states[i.key][0])
            return (
              <NavLink
                key={i.key} label={i.label} active={item === i.key} onClick={() => setItem(i.key)}
                rightSection={<Tooltip label={text}><ColorSwatch size={8} withShadow={false} color={connected ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-red-8)'} /></Tooltip>}
              />
            )
          })}
          <Heading title="Network" />
          <NavLink label="LAN" active={item === 'network'} onClick={() => setItem('network')} />
        </Stack>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!status ? <Loader size="sm" />
            : current ? <current.Pane key={current.key} status={status} setStatus={states[current.key][1]} />
            : <Network status={status} setStatus={setNetwork} />}
        </div>
      </Group>
    </Modal>
  )
}
