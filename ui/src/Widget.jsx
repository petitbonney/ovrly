// Widget node pane: WidgetPane holds the widget's state (its settings, the inputs of its actions, kept data) and lays
// out the settings column (the inputs of the action a signal runs, then the widget's settings, then its id, with a
// button that copies the node) beside the live column (OBS link, preview, and the buttons running its start, stop and
// cancel actions). Also the list of a widget's actions. Autosaved; the instance itself is created when its widget is
// dropped onto the graph, and an action that changes its state on the server (e.g. TwitchPlays' mode) shows here.
import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Alert, Anchor, Badge, Button, Code, CopyButton, Group, Menu, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconChevronDown, IconCopy, IconHourglassHigh, IconPlayerPlay, IconPlayerStop, IconX } from '@tabler/icons-react'
import Fields, { applies, humanize } from './Fields.jsx'
import Heading from './Heading.jsx'
import { json } from './api.js'

// An action's inputs with their defaults, e.g. { text: 'New alert!' }.
const inputDefaults = (inputs = {}) => Object.fromEntries(Object.entries(inputs).map(([key, f]) => [key, f.default ?? '']))

// A widget type's actions that apply with this state (its start, stop and cancel first), each with what it does and the
// inputs it asks for; the one a signal runs is marked. Shown in the widget node's header tooltip.
export function ActionsInfo({ type, state }) {
  const names = Object.keys(type.actions).filter((a) => applies(type.actions[a], state, type.state))
  const order = [type.onStart, type.onStop, type.onCancel]
  names.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9))
  return (
    <Stack gap={8} maw={360}>
      {names.map((name) => {
        const { description, inputs = {} } = type.actions[name]
        return (
          <Stack key={name} gap={2}>
            <Group gap={6}>
              <Text size="xs" fw={700}>{name}</Text>
              {name === type.onSignal && <Badge size="xs" variant="light">this node</Badge>}
            </Group>
            <Text size="xs">{description}</Text>
            {Object.entries(inputs).map(([key, f]) => (
              <Text key={key} size="xs" c="dimmed">
                <Code fz={10}>{key}</Code> {f.hint}{f.default ? ` (default ${f.default})` : ''}
              </Text>
            ))}
          </Stack>
        )
      })}
    </Stack>
  )
}

// The widget node's two columns. context: the node's field context (data keys…); off: the requirements not met
// (Settings.jsx); onChange says the widget was saved; onCopy copies the node for pasting; onError says a save failed.
export default function WidgetPane({ widget, type, context, off, onChange, onCopy, onError }) {
  const [state, setState] = useState(widget.state)
  // The state as the server last had it: a different one coming in was changed there (an action), and replaces ours.
  const known = useRef(JSON.stringify(widget.state))
  useEffect(() => {
    const text = JSON.stringify(widget.state)
    if (text === known.current) return
    known.current = text
    setState(widget.state)
  }, [widget.state])

  const put = (next) => fetch(`/api/widgets/${widget.id}`, json('PUT', { type: widget.type, state: next })).then((res) => {
    if (!res.ok) throw new Error(res.statusText)
    known.current = JSON.stringify(next)
    onChange()
  })
  // Debounced autosave, tried again every few seconds while Ovrly can't be reached; the server pushes the new state to
  // open overlays.
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(state) === known.current) return
      put(state).catch(() => {
        onError()
        setTimeout(() => setRetry((n) => n + 1), 3000)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [state, retry])
  // Saves at once: an action's inputs, before it runs with them.
  const save = (next) => {
    setState(next)
    return put(next)
  }

  return (
    <Group className="widget-split" align="stretch" gap="xl" wrap="nowrap">
      <Stack className="settings" flex="1 1 280px" maw={420}>
        <WidgetSettings widget={widget} type={type} state={state} setState={setState} context={{ ...context, off }} onCopy={onCopy} />
      </Stack>
      <Stack className="live" gap={0} flex="1 1 320px" miw={0}>
        <WidgetPreview widget={widget} type={type} state={state} save={save} />
      </Stack>
    </Group>
  )
}

// The settings column: the inputs of the action a signal runs (none: no such section), then the widget's settings. A
// widget type marked `soon` shows a "Coming soon" note instead of settings.
function WidgetSettings({ widget, type, state, setState, context, onCopy }) {
  const inputs = type.actions[type.onSignal]?.inputs ?? {}
  const setInputs = (values) => setState({ ...state, input: { ...state.input, [type.onSignal]: values } })
  // Settings are the state's keys with a field; the others are data the widget keeps (e.g. loaded options).
  const settings = Object.keys(type.state).filter((key) => key in (type.fields ?? {}))
  const first = settings.filter((key) => ['mode', 'layout'].includes(key))
  return (
    <Stack gap="lg">
      {Object.keys(inputs).length > 0 && (
        <Stack gap={0}>
          <Heading title={humanize(type.onSignal)} />
          <Fields defaults={inputDefaults(inputs)} values={state.input?.[type.onSignal] ?? {}} fields={inputs} context={context} onChange={setInputs} />
        </Stack>
      )}
      <Stack gap="sm">
        <Heading title="Widget" mb={4} />
        <TextInput size="xs" label="Name" value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
        {/* A widget's mode (e.g. chat votes or a Twitch poll) or layout shapes everything below, so it comes first. */}
        {!type.soon && first.length > 0 && (
          <Fields defaults={type.state} fields={type.fields} values={state} onChange={setState} context={context} show={first} />
        )}
        {type.soon ? (
          <Alert variant="light" color="yellow" icon={<IconHourglassHigh size={18} />} title="Coming soon">
            This widget is a work in progress: its settings will come in a later version.
          </Alert>
        ) : (
          <Fields defaults={type.state} fields={type.fields} values={state} onChange={setState} context={context}
            show={settings.filter((key) => !first.includes(key))} />
        )}
      </Stack>
      <Group gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>Instance ID</Text>
        <Tooltip label={widget.id}><Code>{widget.id.slice(0, 8)}</Code></Tooltip>
        <Tooltip label="Copy this node, to paste it into another workflow (same widget)">
          <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconCopy size={12} />} onClick={onCopy}>Copy node</Button>
        </Tooltip>
      </Group>
    </Stack>
  )
}

// The live column: the OBS link, the preview, and buttons running the widget's start, stop and cancel actions, named
// after them. Start sends the inputs saved for its action (variables like {{user}} aren't filled outside a run). Stop
// and Cancel also end a workflow run waiting on the widget: Stop lets it go on, Cancel ends it. The widget's other
// actions (those its settings allow) are in a menu beside Start: one asking for inputs opens a dialog, filled with the
// inputs it last ran with (saved in the state, through save).
function WidgetPreview({ widget, type, state, save }) {
  const url = `${location.origin}/w/${widget.id}`
  const act = (action, input = {}) => fetch(`/api/widgets/${widget.id}/action`, json('POST', { action, input })).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText)
  })
  const start = { ...inputDefaults(type.actions[type.onStart]?.inputs), ...state.input?.[type.onStart] }
  const others = Object.keys(type.actions).filter((a) => ![type.onStart, type.onStop, type.onCancel].includes(a) && applies(type.actions[a], state, type.state))
  // The action whose dialog is open, its inputs as typed, and the error of its last run.
  const [open, setOpen] = useState(null)
  const [draft, setDraft] = useState({})
  const [error, setError] = useState('')
  const pick = (name) => {
    if (!Object.keys(type.actions[name].inputs ?? {}).length) return act(name).catch(() => {})
    setDraft(state.input?.[name] ?? {})
    setError('')
    setOpen(name)
  }
  const run = async () => {
    const inputs = type.actions[open].inputs
    try {
      await save({ ...state, input: { ...state.input, [open]: draft } })
      await act(open, { ...inputDefaults(inputs), ...draft })
      setOpen(null)
    } catch (err) {
      setError(err.message)
    }
  }
  const startButton = <Button size="xs" leftSection={<IconPlayerPlay size={14} />} onClick={() => act(type.onStart, start).catch(() => {})}>{humanize(type.onStart)}</Button>
  return (
    <>
      <Group gap={6} mb="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>OBS browser source:</Text>
        <Tooltip label="Open in a new tab"><Anchor size="xs" href={url} target="_blank" truncate>{url}</Anchor></Tooltip>
        <CopyButton value={url}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy link'}>
              <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} aria-label="Copy link" onClick={copy}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      {/* A widget with nothing to see (visual: false) keeps its page, hidden, so Start still plays it here. */}
      <div className="preview-fit" hidden={type.visual === false}><iframe className="preview" src={url} title="Preview" /></div>
      <Group gap="xs" mt="xs">
        {!others.length ? startButton : (
          <Button.Group>
            {startButton}
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button size="xs" px={6} aria-label="More actions"><IconChevronDown size={14} /></Button>
              </Menu.Target>
              <Menu.Dropdown>
                {others.map((name) => (
                  <Tooltip key={name} label={type.actions[name].description} multiline w={260} position="left" withinPortal disabled={!type.actions[name].description}>
                    <Menu.Item onClick={() => pick(name)}>{humanize(name)}</Menu.Item>
                  </Tooltip>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Button.Group>
        )}
        <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} onClick={() => act(type.onStop).catch(() => {})}>{humanize(type.onStop)}</Button>
        <Button size="xs" variant="default" leftSection={<IconX size={14} />} onClick={() => act(type.onCancel).catch(() => {})}>{humanize(type.onCancel)}</Button>
      </Group>
      <Modal opened={!!open} onClose={() => setOpen(null)} title={open && humanize(open)} size="sm">
        {open && (
          <Stack gap="sm">
            <Text size="xs" c="dimmed">{type.actions[open].description}</Text>
            <Fields defaults={inputDefaults(type.actions[open].inputs)} values={draft} fields={type.actions[open].inputs} context={{ trigger: true }} onChange={setDraft} />
            {error && <Text size="xs" c="red">{error}</Text>}
            <Group justify="flex-end"><Button size="xs" onClick={run}>Run</Button></Group>
          </Stack>
        )}
      </Modal>
    </>
  )
}
