// Settings dialog: a left column of sections (Integrations, Network, Appearance) like the node library, and the pane of
// the clicked item on the right. Integrations show their status (StatusIcon); saving reconnects. The app polls the
// statuses (useStatuses) and opens the dialog, also from anywhere with openSettings(item).
import { useEffect, useState } from 'react'
import { Anchor, Button, Code, Group, Loader, Modal, NavLink, Paper, PasswordInput, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core'
import { IconAlertCircle, IconBrandTwitch, IconCircleCheck, IconCircleDashed, IconExternalLink, IconLogout } from '@tabler/icons-react'
import Heading from './Heading.jsx'
import themes from './themes.js'
import { get, json } from './api.js'

// Opens the Settings dialog on a pane: an integration key, 'network' or 'appearance'.
export const openSettings = (item) => window.dispatchEvent(new CustomEvent('ovrly-settings', { detail: item }))

// An integration's status as an icon whose shape and color both say it: a check when connected, "!" when set up but
// failing, a dashed circle when not set up. Its tooltip says more.
const STATES = { ok: [IconCircleCheck, 'green'], error: [IconAlertCircle, 'red'], off: [IconCircleDashed, 'gray'] }
export function StatusIcon({ info }) {
  const [Icon, color] = STATES[info.state]
  return (
    <Tooltip label={info.text}>
      <Icon size={16} color={`var(--mantine-color-${color}-6)`} role="img" aria-label={info.text} style={{ flexShrink: 0 }} />
    </Tooltip>
  )
}

// A pane's fields, the status, and a Connect button (or another label) that saves (none without onSave).
function Pane({ onSave, button = 'Connect', status, children }) {
  const save = (e) => {
    e.preventDefault()
    onSave?.()
  }
  return (
    <form onSubmit={save}>
      <Stack gap="sm">
        {children}
        <Text size="xs" c={{ ok: 'green', error: 'red', off: 'dimmed' }[status.state]}>{status.text}</Text>
        {onSave && <Group justify="end"><Button size="xs" type="submit">{button}</Button></Group>}
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

// What each integration's status says: { state: ok | error | off (not set up), text }.
const checking = { state: 'off', text: 'Checking…' }
const twitchInfo = (s) => !s ? checking
  : !s.channel ? (s.mode === 'streamer' ? { state: 'error', text: 'Streamer mode: sign in to Twitch' } : { state: 'off', text: 'No channel set' })
  : !s.connected ? { state: 'error', text: `Connecting to #${s.channel}…` }
  : s.mode === 'streamer' && !s.streamer ? { state: 'error', text: `Chat of #${s.channel}; sign in ${s.account?.login ? 'again ' : ''}for Streamer features` }
  : s.mode === 'streamer' && !s.eventsub?.connected ? { state: 'error', text: `Chat of #${s.channel}; Twitch events: ${s.eventsub?.error || 'connecting…'}` }
  : { state: 'ok', text: `Connected to #${s.channel}${s.mode === 'streamer' ? ' as streamer' : ''}` }
const obsInfo = (s) => !s ? checking
  : s.connected ? { state: 'ok', text: `Connected to ${s.url}` }
  : !s.url ? { state: 'off', text: 'No URL set' }
  : { state: 'error', text: `Not connected: ${s.error || 'connecting…'}` }
const streamdeckInfo = (s) => !s ? checking
  : s.connected ? { state: 'ok', text: `Plugin connected: ${s.keys.length} key${s.keys.length === 1 ? '' : 's'} paired` }
  : { state: 'off', text: 'Plugin not connected: is the Stream Deck app running, with the Ovrly plugin?' }
const hueInfo = (s) => !s ? checking
  : s.connected ? { state: 'ok', text: `Paired with the bridge at ${s.ip}` }
  : !s.ip ? { state: 'off', text: 'No bridge paired' }
  : { state: 'error', text: s.error || 'Checking…' }
const giphyInfo = (s) => !s ? checking
  : s.connected ? { state: 'ok', text: 'API key accepted' }
  : !s.key ? { state: 'off', text: 'No API key set' }
  : { state: 'error', text: s.error || 'Checking…' }

// Twitch: Guest reads any channel's chat with no sign-in; Streamer signs in as the channel owner, which the
// Twitch features of nodes and widgets (polls, predictions…) need. Until signed in, it keeps reading the Guest channel.
function Twitch({ status, setStatus, info }) {
  const [form, setForm] = useState({ mode: status.mode ?? 'guest', channel: status.guestChannel ?? '' })
  const save = async (settings) => setStatus(await (await fetch('/api/twitch', json('PUT', settings))).json())
  // Switching modes applies at once (with the saved channel); in Guest mode, Connect saves a new channel.
  const switchMode = (mode) => {
    setForm({ ...form, mode })
    save({ mode, channel: status.guestChannel ?? '' })
  }
  return (
    <Pane onSave={form.mode === 'guest' ? () => save(form) : undefined} status={info}>
      <SegmentedControl size="xs" fullWidth data={modes} value={form.mode} onChange={switchMode} />
      {form.mode === 'guest' ? (
        <>
          <Text size="xs" c="dimmed">Reads the chat of any channel, without signing in: enough for chat triggers and chat votes.</Text>
          <TextInput size="xs" label="Channel" placeholder="channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} data-autofocus />
        </>
      ) : (
        <>
          <Text size="xs" c="dimmed">Sign in as the channel owner: reads your chat and unlocks Twitch features: EventSub triggers, Twitch actions, and Twitch polls and predictions in the Voting widget.</Text>
          {!status.account?.login && status.guestChannel && <Text size="xs" c="dimmed">Until then, Ovrly keeps reading the chat of #{status.guestChannel}.</Text>}
          <TwitchAccount account={status.account} setStatus={setStatus} />
        </>
      )}
    </Pane>
  )
}

function Obs({ status, setStatus, info }) {
  const [form, setForm] = useState({ url: status.url ?? '', password: status.password ?? '' })
  const save = async () => setStatus(await (await fetch('/api/obs', json('PUT', form))).json())
  return (
    <Pane onSave={save} status={info}>
      <Text size="xs" c="dimmed">In OBS: Tools → WebSocket Server Settings. Turn the server on, then copy its port and password.</Text>
      <TextInput size="xs" label="WebSocket URL" placeholder="ws://localhost:4455" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} data-autofocus />
      <PasswordInput size="xs" label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
    </Pane>
  )
}

function Giphy({ status, setStatus, info }) {
  const [key, setKey] = useState(status.key ?? '')
  const save = async () => setStatus(await (await fetch('/api/giphy', json('PUT', { key }))).json())
  return (
    <Pane onSave={save} status={info}>
      <Text size="xs" c="dimmed">
        Create an app of type API at <Anchor size="xs" href="https://developers.giphy.com/dashboard/" target="_blank">developers.giphy.com</Anchor>, then paste its API key.
      </Text>
      <PasswordInput size="xs" label="API key" value={key} onChange={(e) => setKey(e.target.value)} data-autofocus />
    </Pane>
  )
}

// Philips Hue: pairs with the bridge at an IP, once its link button was pressed (Pair saves the key it gives).
function Hue({ status, setStatus, info }) {
  const [ip, setIp] = useState(status.ip ?? '')
  const pair = async () => setStatus(await (await fetch('/api/hue/pair', json('POST', { ip }))).json())
  return (
    <Pane onSave={pair} button="Pair" status={info}>
      <Text size="xs" c="dimmed">
        Find the bridge's IP in the Hue app: Settings → Bridges → your bridge. Press the round button on the bridge, then Pair within 30 seconds.
      </Text>
      <TextInput size="xs" label="Bridge IP" placeholder="192.168.1.20" value={ip} onChange={(e) => setIp(e.target.value)} data-autofocus />
    </Pane>
  )
}

// Stream Deck: the Ovrly plugin (in streamdeck/) shows Control Pad node buttons on keys and fires them. It connects by
// itself, so there is nothing to set here: how to install it, and the devices it sees.
function StreamDeck({ status, info }) {
  return (
    <Pane status={info}>
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

// Appearance: the editor's theme (themes.js), kept by this browser: a card per theme, dark ones then light ones, each
// with its name and colors.
function Appearance({ theme, onTheme }) {
  const group = (scheme) => (
    <SimpleGrid cols={3} spacing="xs">
      {Object.entries(themes).filter(([, t]) => t.scheme === scheme).map(([key, t]) => (
        <UnstyledButton key={key} onClick={() => onTheme(key)} aria-pressed={key === theme} p="xs"
          style={{ borderRadius: 'var(--mantine-radius-sm)', background: t.swatch[0], outline: key === theme ? '2px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)' }}>
          <Group gap={4} mb={6}>{t.swatch.slice(1).map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}</Group>
          <Text size="xs" fw={600} c={t.scheme === 'dark' ? '#ffffff' : '#000000'}>{t.label}</Text>
        </UnstyledButton>
      ))}
    </SimpleGrid>
  )
  return (
    <Stack gap="xs">
      <Heading title="Dark" mb={0} />
      {group('dark')}
      <Heading title="Light" mt="xs" mb={0} />
      {group('light')}
      <Text size="xs" c="dimmed" mt="xs">Overlays in OBS keep their own look.</Text>
    </Stack>
  )
}

// Integration key -> its label, status and pane. `ready` says from the status whether the nodes needing it can run,
// `needs` is the note they show when it can't.
export const integrations = [
  { key: 'twitch', label: 'Twitch', path: '/api/twitch', info: twitchInfo, Pane: Twitch, ready: (s) => s.streamer, needs: 'Twitch in Streamer mode, signed in' },
  { key: 'obs', label: 'OBS', path: '/api/obs', info: obsInfo, Pane: Obs, ready: (s) => s.connected, needs: 'OBS connected' },
  { key: 'streamdeck', label: 'Stream Deck', path: '/api/streamdeck', info: streamdeckInfo, Pane: StreamDeck, ready: (s) => s.connected, needs: 'the Ovrly Stream Deck plugin connected' },
  { key: 'hue', label: 'Philips Hue', path: '/api/hue', info: hueInfo, Pane: Hue, ready: (s) => s.connected, needs: 'the Hue bridge paired' },
  { key: 'giphy', label: 'Giphy', path: '/api/giphy', info: giphyInfo, Pane: Giphy, ready: (s) => s.connected, needs: 'Giphy connected (API key)' },
]
// What a node, a widget type or a setting option can need (`needs`): an integration ready, or 'chat': the Twitch chat
// read, in Guest or Streamer mode (set up in the Twitch pane).
export const requirements = [
  ...integrations,
  { key: 'chat', label: 'Twitch', path: '/api/twitch', ready: (s) => s.connected, needs: 'the Twitch chat connected', pane: 'twitch' },
]
// The requirement keys not met now (none while the statuses load).
export const unmet = (statuses) => requirements.filter((r) => statuses[r.path] && !r.ready(statuses[r.path])).map((r) => r.key)

// Every integration's status and the network's, by API path, polled so they follow connects and disconnects.
// set(path, status or (old) => status) applies a pane's own update at once.
const PATHS = [...integrations.map((i) => i.path), '/api/network']
export function useStatuses() {
  const [statuses, setStatuses] = useState({})
  const set = (path, s) => setStatuses((all) => ({ ...all, [path]: typeof s === 'function' ? s(all[path]) : s }))
  useEffect(() => {
    const load = () => PATHS.forEach((path) => get(path).then((s) => set(path, s), () => {}))
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [])
  return [statuses, set]
}

// item: the pane shown; onItem(item) switches panes.
export default function Settings({ opened, item, onItem, onClose, statuses, setStatus, theme, onTheme }) {
  const current = integrations.find((i) => i.key === item)
  const status = current ? statuses[current.path] : statuses['/api/network']
  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="xl">
      <Group align="stretch" gap="md" wrap="nowrap" mih={340}>
        <Stack gap={0} w={180} pr="md" style={{ borderRight: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}>
          <Heading title="Integrations" />
          {integrations.map((i) => (
            <NavLink key={i.key} component="button" label={i.label} active={item === i.key} onClick={() => onItem(i.key)} rightSection={<StatusIcon info={i.info(statuses[i.path])} />} />
          ))}
          <Heading title="Network" mt="sm" />
          <NavLink component="button" label="LAN" active={item === 'network'} onClick={() => onItem('network')} />
          <Heading title="Appearance" mt="sm" />
          <NavLink component="button" label="Theme" active={item === 'appearance'} onClick={() => onItem('appearance')} />
        </Stack>
        <div style={{ flex: 1, minWidth: 0 }}>
          {item === 'appearance' ? <Appearance theme={theme} onTheme={onTheme} />
            : !status ? <Loader size="sm" />
            : current ? <current.Pane key={current.key} status={status} info={current.info(status)} setStatus={(s) => setStatus(current.path, s)} />
            : <Network status={status} setStatus={(s) => setStatus('/api/network', s)} />}
        </div>
      </Group>
    </Modal>
  )
}
