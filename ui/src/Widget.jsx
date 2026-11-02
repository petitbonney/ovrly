// Widget node pane: WidgetPane holds the widget's state (its settings, the inputs of its actions, kept data) and lays
// out the settings column (a Widget tab with the widget's settings, then a tab per action port with its inputs) beside
// the live column (OBS link, preview, and the buttons running its start, stop and cancel actions). Also the header's list of a
// widget's actions and its menu (copy the node, or its instance ID). Autosaved; the instance itself is created when its
// widget is dropped onto the graph, and an action that changes its state on the server (e.g. TwitchPlays' mode) shows
// here.
import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Alert, Anchor, Button, CloseButton, Code, CopyButton, Divider, Group, Menu, Modal, Popover, SimpleGrid, Stack, Tabs, Text, TextInput, Tooltip } from '@mantine/core'
import { IconBolt, IconBox, IconCheck, IconChevronDown, IconCopy, IconDots, IconHourglassHigh, IconId, IconInfoCircle, IconPlayerPlay, IconPlayerStop, IconPlus, IconX } from '@tabler/icons-react'
import Fields, { applies, humanize } from './Fields.jsx'
import Notice from './Notice.jsx'
import { widgetPorts } from './FlowNode.jsx'
import { json } from './api.js'

// An action's inputs with their defaults, e.g. { text: 'New alert!' }.
const inputDefaults = (inputs = {}) => Object.fromEntries(Object.entries(inputs).map(([key, f]) => [key, f.default ?? '']))
// Inputs as sent outside a workflow run: a list sends its own items (there is no data to read a key from).
const sent = (inputs = {}, values) => Object.fromEntries(Object.entries(values).map(([key, v]) => [key, inputs[key]?.type === 'list' ? v?.items ?? [] : v]))

// The widget's name, in its node's settings header: a double click turns it into a field, saved on Enter or leaving it
// (empty: kept as it was), Escape giving up. A failed save keeps the field open, saying so. onChange says it was saved.
export function WidgetName({ widget, onChange }) {
  const [draft, setDraft] = useState(null) // the name being typed, null when not renaming
  const [failed, setFailed] = useState(false)
  const done = (name) => {
    setDraft(null)
    setFailed(false)
    if (!name?.trim() || name.trim() === widget.state.name) return
    fetch(`/api/widgets/${widget.id}`, json('PUT', { type: widget.type, state: { ...widget.state, name: name.trim() } })).then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      onChange()
    }).catch(() => {
      setDraft(name)
      setFailed(true)
    })
  }
  if (draft === null) {
    return <Tooltip label="Double-click to rename" openDelay={500}><Text fw={600} truncate onDoubleClick={() => setDraft(widget.state.name)}>{widget.state.name}</Text></Tooltip>
  }
  return (
    <TextInput size="xs" autoFocus value={draft} aria-label="Widget name" error={failed && 'Not saved: is Ovrly running?'} onChange={(e) => setDraft(e.target.value)} onBlur={() => done(draft)}
      onFocus={(e) => e.target.select()} onKeyDown={(e) => {
        e.stopPropagation() // not the editor's shortcuts (Escape closes the pane)
        if (e.key === 'Enter') done(draft)
        if (e.key === 'Escape') setDraft(null)
      }} />
  )
}

// A widget type's actions that apply with this state (its start, stop and cancel first), each with what it does and the
// inputs it asks for; the one a signal runs is marked with a bolt. An info icon in the widget node's header: hovering shows them,
// clicking keeps them open until a click outside (or Escape).
export function ActionsInfo({ type, state }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const names = Object.keys(type.actions).filter((a) => applies(type.actions[a], state, type.state))
  const order = [type.onStart, type.onStop, type.onCancel]
  names.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9))
  return (
    <Popover opened={hover || pinned} onDismiss={() => { setPinned(false); setHover(false) }} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <ActionIcon size="sm" variant={pinned ? 'light' : 'subtle'} color="gray" aria-label="Actions" style={{ flexShrink: 0 }}
          onClick={() => setPinned(!pinned)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <IconInfoCircle size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p="sm">
        <Stack gap="sm" maw={360}>
          {names.map((name) => {
            const { description, inputs = {} } = type.actions[name]
            return (
              <Stack key={name} gap={2}>
                <Group gap={4}>
                  <Text size="sm" fw={600}>{name}</Text>
                  {name === type.onSignal && (
                    <Tooltip label="Run by a signal reaching this node">
                      <IconBolt size={14} fill="currentColor" color="var(--ovrly-trigger)" aria-label="Run by a signal" />
                    </Tooltip>
                  )}
                </Group>
                <Text size="xs" c="dimmed">{description}</Text>
                {Object.entries(inputs).map(([key, f]) => (
                  <Text key={key} size="xs">
                    {/* Tinted from the text color: Code's own background is the dropdown's in dark mode. */}
                    <Code fz={10} c="var(--mantine-color-text)" bg="color-mix(in srgb, var(--mantine-color-text) 14%, transparent)">{key}</Code>
                    {' '}{f.hint}{f.default && <Text span size="xs" c="dimmed"> (default {f.default})</Text>}
                  </Text>
                ))}
              </Stack>
            )
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

// The widget node's menu, in its header: copy the node (to paste it here or into another workflow: a new widget with
// the same settings), or the widget's instance ID.
export function WidgetMenu({ widget, onCopy }) {
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Widget menu" style={{ flexShrink: 0 }}><IconDots size={16} /></ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconCopy size={14} />} onClick={onCopy}>Copy node</Menu.Item>
        <Menu.Item leftSection={<IconId size={14} />} onClick={() => navigator.clipboard.writeText(widget.id)}>
          Copy instance ID <Code fz={10}>{widget.id.slice(0, 8)}</Code>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

// The widget node's two columns. context: the node's field context (data keys, links into it…); off: the requirements
// not met (Settings.jsx); config: the node's settings (its ports), set with onConfig; onChange says the widget was
// saved; onError says a save failed.
export default function WidgetPane({ widget, type, context, off, config, onConfig, onChange, onError }) {
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
  // What the debounce hasn't saved yet is sent at once when the pane closes (another node picked, Escape) or the page
  // goes; keepalive lets it outlive the page, for a body up to 64 KB: only then.
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    const flush = (keepalive) => {
      const text = JSON.stringify(latest.current)
      if (text === known.current) return
      known.current = text
      fetch(`/api/widgets/${widget.id}`, { ...json('PUT', { type: widget.type, state: latest.current }), keepalive }).then(onChange, () => {})
    }
    const onHide = () => flush(true)
    addEventListener('pagehide', onHide)
    return () => {
      removeEventListener('pagehide', onHide)
      flush(false)
    }
  }, [])
  // Saves at once: an action's inputs, before it runs with them.
  const save = (next) => {
    setState(next)
    return put(next)
  }

  return (
    <SimpleGrid className="widget-split" cols={2} spacing="xl">
      <Stack className="settings">
        <SettingsTabs type={type} state={state} setState={setState} config={config} context={{ ...context, off }} onConfig={onConfig} />
      </Stack>
      <Stack className="live" gap={0}>
        <WidgetPreview widget={widget} type={type} state={state} save={save} />
      </Stack>
    </SimpleGrid>
  )
}

// The settings column's tabs: Widget (the widget's settings) first, then, past a divider, one per action with a port on
// the node (the main one, which a signal runs, then those exposed, in the node's order): what it does and its inputs,
// saved in the widget's state. "+" exposes another action (those the settings allow); × takes one off, with the links
// into its port (its inputs stay saved, for its return). Dragging an exposed tab reorders them and the node's ports;
// the main one stays first. The Basic view (context.basic), where a widget node has only its main port's link, shows
// the main action's tab alone, without × or dragging, and its "+" goes to the Graph view (context.graph) to add the
// port there. An exposed action the settings no longer allow (Voting's "vote" in Twitch mode) keeps its port, which
// then does nothing: its tab says so. A widget type marked `soon` shows a "Coming soon" note instead of settings.
const WIDGET = '#widget' // the Widget tab's value, apart from action names
function SettingsTabs({ type, state, setState, config, context, onConfig }) {
  const ports = widgetPorts(type, config).map((p) => p.id ?? type.onSignal)
  const exposed = ports.slice(1)
  const shown = context.basic ? [type.onSignal] : ports
  const [tab, setTab] = useState(WIDGET)
  // While a tab is dragged: { from, over }, positions in exposed (over: where it would land, exposed.length: last).
  const [drag, setDrag] = useState(null)
  const drop = () => {
    const list = exposed.filter((_, i) => i !== drag.from)
    list.splice(drag.over > drag.from ? drag.over - 1 : drag.over, 0, exposed[drag.from])
    setDrag(null)
    setPorts(list)
  }
  const open = tab === WIDGET || shown.includes(tab) ? tab : type.onSignal
  const others = Object.keys(type.actions).filter((a) => !ports.includes(a) && applies(type.actions[a], state, type.state))
  const setPorts = (list) => onConfig({ ...config, ports: list })
  const inputs = type.actions[open]?.inputs ?? {}
  // Settings are the state's keys with a field, in the state's order; the others are data the widget keeps (e.g.
  // loaded options).
  const settings = Object.keys(type.state).filter((key) => key in (type.fields ?? {}))
  // An exposed tab, at i in exposed, can be dragged; the drop spot shows as a line before the tab (or after the last).
  const dragProps = (i) => ({
    draggable: true,
    style: { boxShadow: drag && drag.from !== i && (drag.over === i ? 'inset 2px 0 0 var(--mantine-color-blue-5)'
      : drag.over === exposed.length && i === exposed.length - 1 ? 'inset -2px 0 0 var(--mantine-color-blue-5)' : undefined) },
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/ovrly-port', exposed[i]) // Firefox needs some data to drag
      setDrag({ from: i, over: i })
    },
    onDragOver: (e) => {
      if (!drag) return
      e.preventDefault()
      const { left, width } = e.currentTarget.getBoundingClientRect()
      const over = e.clientX > left + width / 2 ? i + 1 : i
      if (over !== drag.over) setDrag({ ...drag, over })
    },
    onDrop: (e) => {
      e.preventDefault()
      if (drag) drop()
    },
    onDragEnd: () => setDrag(null),
  })
  const body = open === WIDGET ? (
    <Stack mt="sm" gap={0}>
      {type.soon ? (
        <Alert variant="light" color="yellow" icon={<IconHourglassHigh size={18} />} title="Coming soon">
          This widget is a work in progress: its settings will come in a later version.
        </Alert>
      ) : (
        <Fields defaults={type.state} fields={type.fields} values={state} onChange={setState} context={context} show={settings} />
      )}
    </Stack>
  ) : (
    <>
      {type.actions[open]?.description && <Text size="xs" c="dimmed" mt="xs">{type.actions[open].description}</Text>}
      {!applies(type.actions[open], state, type.state) && (
        <Stack mt="sm"><Notice>The widget's settings don't allow {humanize(open)} now: a link into its port does nothing.</Notice></Stack>
      )}
      {Object.keys(inputs).length > 0 && (
        <Stack mt="sm" gap={0}>
          <Fields key={open} defaults={inputDefaults(inputs)} values={state.input?.[open] ?? {}} fields={inputs} context={context}
            onChange={(v) => setState({ ...state, input: { ...state.input, [open]: v } })} />
        </Stack>
      )}
    </>
  )
  const Icon = type.Icon ?? IconBox
  return (
    <Tabs value={open} onChange={setTab}>
      <Tabs.List>
        <Tabs.Tab value={WIDGET} leftSection={<Icon size={14} />}>Widget</Tabs.Tab>
        <Divider orientation="vertical" mx={4} my={6} />
        {shown.map((a, j) => (
          <Tabs.Tab key={a} value={a} {...(!context.basic && j > 0 && dragProps(j - 1))} rightSection={!context.basic && a !== type.onSignal && (
            <CloseButton component="span" size="xs" aria-label={`Remove the ${humanize(a)} port`} onClick={(e) => {
              e.stopPropagation() // don't open the tab
              setPorts(config.ports.filter((p) => p !== a))
            }} />
          )}>{humanize(a)}</Tabs.Tab>
        ))}
        {others.length > 0 && (
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <Tooltip label={context.basic ? 'Add a port running another action (opens the Graph view)' : 'Add a port running another action'}>
                <ActionIcon variant="subtle" color="gray" aria-label="Add a port" style={{ alignSelf: 'center' }}><IconPlus size={14} /></ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              {others.map((a) => (
                <Tooltip key={a} label={type.actions[a].description} multiline w={260} position="right" withinPortal disabled={!type.actions[a].description}>
                  <Menu.Item onClick={() => {
                    if (context.basic) context.graph()
                    setPorts([...(config.ports ?? []), a])
                    setTab(a)
                  }}>{humanize(a)}</Menu.Item>
                </Tooltip>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Tabs.List>
      {body}
    </Tabs>
  )
}

// The live column: the OBS link, the preview, and buttons running the widget's start, stop and cancel actions: Start
// named after its action, Stop and Cancel always named so. Start sends the inputs saved for its action (variables like
// {{user}} aren't filled outside a run). Stop and Cancel also end a workflow run waiting on the widget: Stop lets it go
// on, Cancel ends it. The widget's other actions (those its settings allow, Stop's and Cancel's aside, e.g. Lottery's
// reset) are in a menu beside Start: one asking for inputs opens a dialog, filled with the inputs it last ran with
// (saved in the state, through save).
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
  // An action run from the buttons (or the menu, with no inputs) that failed says why under them, until one works.
  const [failed, setFailed] = useState('')
  const press = (action, input) => act(action, input).then(() => setFailed(''), (err) => setFailed(`${humanize(action)} failed: ${err.message}`))
  const pick = (name) => {
    if (!Object.keys(type.actions[name].inputs ?? {}).length) return press(name)
    setDraft(state.input?.[name] ?? {})
    setError('')
    setOpen(name)
  }
  const run = async () => {
    const inputs = type.actions[open].inputs
    try {
      await save({ ...state, input: { ...state.input, [open]: draft } })
      await act(open, sent(inputs, { ...inputDefaults(inputs), ...draft }))
      setOpen(null)
    } catch (err) {
      setError(err.message)
    }
  }
  // Start saves the settings first: an action changing the state (Countdown's end) would push it back without an edit
  // the autosave hasn't sent yet.
  const startButton = <Button size="xs" leftSection={<IconPlayerPlay size={14} />} onClick={() => save(state).then(() => press(type.onStart, sent(type.actions[type.onStart]?.inputs, start)), (err) => setFailed(`${humanize(type.onStart)} failed: ${err.message}`))}>{humanize(type.onStart)}</Button>
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
        <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} onClick={() => press(type.onStop)}>Stop</Button>
        <Button size="xs" variant="default" leftSection={<IconX size={14} />} onClick={() => press(type.onCancel)}>Cancel</Button>
      </Group>
      {failed && <Text size="xs" c="red" mt="xs">{failed}</Text>}
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
