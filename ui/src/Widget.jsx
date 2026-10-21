// Widget instance settings, shown in a widget node's settings pane: id, name, the inputs of the action the node runs,
// OBS link, settings and preview, with buttons to start, stop and cancel it. Also the list of a widget's actions.
// Autosaved; the instance itself is created when its widget is dropped onto the graph.
import { useEffect, useState } from 'react'
import { ActionIcon, Alert, Anchor, Badge, Button, Code, CopyButton, Divider, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconHourglassHigh, IconPlayerPlay, IconPlayerStop, IconX } from '@tabler/icons-react'
import Fields, { applies } from './Fields.jsx'
import { get, json } from './api.js'

// A widget type's actions that apply with this config ("start", "stop" and "cancel" first), each with what it does and
// the inputs it asks for; the one its widget node runs is marked. Shown in the widget node's header tooltip.
export function ActionsInfo({ type, config }) {
  const names = Object.keys(type.actions).filter((a) => applies(type.actions[a], config, type.config))
  const order = ['start', 'stop', 'cancel']
  names.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9))
  return (
    <Stack gap={8} maw={360}>
      {names.map((name) => {
        const { description, inputs = {} } = type.actions[name]
        return (
          <Stack key={name} gap={2}>
            <Group gap={6}>
              <Text size="xs" fw={700}>{name}</Text>
              {name === type.linked && <Badge size="xs" variant="light">this node</Badge>}
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

// A widget node's settings: the instance's id and name, its mode or layout, then the inputs of the action the node runs
// (inputs: their fields), if it takes any, and its other settings. A widget
// type marked `soon` shows a "Coming soon" note instead of settings. onCopy copies the node for pasting. testInput is
// the node's inputs, sent as they are by Start when the node runs "start" (variables like {{user}} aren't filled
// outside a run). Stop and Cancel also end a workflow run waiting on the widget: Stop lets it go on, Cancel ends it.
export default function WidgetSettings({ widget, type, inputs, testInput, onChange, onCopy }) {
  const [name, setName] = useState(widget.name)
  const [config, setConfig] = useState(widget.config)
  // Whether Twitch features (options marked streamer) can run, for the settings to say so.
  const [streamer, setStreamer] = useState(true)
  useEffect(() => {
    get('/api/twitch').then((s) => setStreamer(s.streamer), () => {})
  }, [])

  // Debounced autosave; the server pushes the new config to open overlays.
  useEffect(() => {
    if (name === widget.name && config === widget.config) return
    const timer = setTimeout(() => fetch(`/api/widgets/${widget.id}`, json('PUT', { name, type: widget.type, config })).then(onChange), 500)
    return () => clearTimeout(timer)
  }, [name, config])

  const url = `${location.origin}/w/${widget.id}`
  const act = (action, input) => fetch(`/api/widgets/${widget.id}/action`, json('POST', { action, input }))
  const first = ['mode', 'layout'].filter((key) => key in type.config)
  return (
    // Settings on the left scroll; the preview on the right never does, it shrinks to fit the pane's height.
    <Group className="widget-split" align="stretch" gap="xl" wrap="nowrap">
      <Stack className="settings" gap="md" flex="1 1 280px" maw={420}>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed">Instance ID</Text>
          <Code>{widget.id}</Code>
          <Tooltip label="Copy this node, to paste it into another workflow (same widget)">
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={onCopy}><IconCopy size={16} /></ActionIcon>
          </Tooltip>
        </Group>
        <TextInput size="xs" label="Name" description="Shared by every node that uses this widget" value={name} onChange={(e) => setName(e.target.value)} />
        {/* A widget's mode (e.g. chat votes or a Twitch poll) or layout shapes everything below, so it comes first. */}
        {!type.soon && first.length > 0 && (
          <Fields defaults={type.config} fields={type.fields} values={config} onChange={setConfig} context={{ streamer }} show={first} />
        )}
        <Divider />
        {inputs}
        {type.soon ? (
          <Alert variant="light" color="yellow" icon={<IconHourglassHigh size={18} />} title="Coming soon">
            This widget is a work in progress: its settings will come in a later version.
          </Alert>
        ) : (
          <Fields defaults={type.config} fields={type.fields} values={config} onChange={setConfig} context={{ streamer }}
            show={Object.keys(type.config).filter((key) => !first.includes(key))} />
        )}
      </Stack>
      <Stack gap={0} flex="1 1 320px" miw={0}>
        <Group gap={6} mb="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>OBS browser source:</Text>
          <Tooltip label="Open in a new tab"><Anchor size="xs" href={url} target="_blank" truncate>{url}</Anchor></Tooltip>
          <CopyButton value={url}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy link'}>
                <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
        {/* A widget with nothing to see (visual: false) keeps its page, hidden, so Start still plays it here. */}
        <div className="preview-fit" hidden={type.visual === false}><iframe className="preview" src={url} title="Preview" /></div>
        <Group gap="xs" mt="xs">
          <Button size="xs" leftSection={<IconPlayerPlay size={14} />} onClick={() => act('start', type.linked === 'start' ? testInput : {})}>Start</Button>
          <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} onClick={() => act('stop')}>Stop</Button>
          <Button size="xs" variant="default" leftSection={<IconX size={14} />} onClick={() => act('cancel')}>Cancel</Button>
        </Group>
      </Stack>
    </Group>
  )
}
