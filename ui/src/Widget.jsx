// Widget node settings: WidgetSettings, the settings column ("This node": the inputs of the action the node runs;
// "Widget (shared)": the instance's name, mode or layout and settings, shared by every node using it; then its id, with
// a button that copies the node), and WidgetPreview, the live column (OBS link, preview, Start, Stop and Cancel). Also
// the list of a widget's actions. Autosaved; the instance itself is created when its widget is dropped onto the graph.
import { useEffect, useState } from 'react'
import { ActionIcon, Alert, Anchor, Badge, Button, Code, CopyButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconHourglassHigh, IconPlayerPlay, IconPlayerStop, IconX } from '@tabler/icons-react'
import Fields, { applies } from './Fields.jsx'
import Heading from './Heading.jsx'
import { json } from './api.js'

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

// A widget node's settings column. inputs: the fields of the action the node runs (none: no "This node" section);
// off: the requirements not met (Settings.jsx); onCopy copies the node for pasting; onError says a save failed. A
// widget type marked `soon` shows a "Coming soon" note instead of settings.
export default function WidgetSettings({ widget, type, inputs, off, onChange, onCopy, onError }) {
  const [name, setName] = useState(widget.name)
  const [config, setConfig] = useState(widget.config)

  // Debounced autosave, tried again every few seconds while Ovrly can't be reached; the server pushes the new config to
  // open overlays.
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (name === widget.name && config === widget.config) return
    const timer = setTimeout(() => fetch(`/api/widgets/${widget.id}`, json('PUT', { name, type: widget.type, config })).then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      onChange()
    }).catch(() => {
      onError()
      setTimeout(() => setRetry((n) => n + 1), 3000)
    }), 500)
    return () => clearTimeout(timer)
  }, [name, config, retry])

  const first = ['mode', 'layout'].filter((key) => key in type.config)
  const hasInputs = Object.keys(type.actions[type.linked]?.inputs ?? {}).length > 0
  return (
    <Stack gap="lg">
      {hasInputs && (
        <Stack gap={0}>
          <Heading title="This node" />
          {inputs}
        </Stack>
      )}
      <Stack gap="sm">
        <div>
          <Heading title="Widget (shared)" mb={4} />
          <Text size="xs" c="dimmed">Shared by every node that uses this widget.</Text>
        </div>
        <TextInput size="xs" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        {/* A widget's mode (e.g. chat votes or a Twitch poll) or layout shapes everything below, so it comes first. */}
        {!type.soon && first.length > 0 && (
          <Fields defaults={type.config} fields={type.fields} values={config} onChange={setConfig} context={{ off }} show={first} />
        )}
        {type.soon ? (
          <Alert variant="light" color="yellow" icon={<IconHourglassHigh size={18} />} title="Coming soon">
            This widget is a work in progress: its settings will come in a later version.
          </Alert>
        ) : (
          <Fields defaults={type.config} fields={type.fields} values={config} onChange={setConfig} context={{ off }}
            show={Object.keys(type.config).filter((key) => !first.includes(key))} />
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

// A widget node's live column: the OBS link, the preview, and Start, Stop and Cancel. Start sends the node's inputs
// (testInput) with their defaults when the node runs "start" (variables like {{user}} aren't filled outside a run).
// Stop and Cancel also end a workflow run waiting on the widget: Stop lets it go on, Cancel ends it.
export function WidgetPreview({ widget, type, testInput }) {
  const url = `${location.origin}/w/${widget.id}`
  const act = (action, input) => fetch(`/api/widgets/${widget.id}/action`, json('POST', { action, input }))
  const defaults = Object.fromEntries(Object.entries(type.actions[type.linked]?.inputs ?? {}).map(([key, f]) => [key, f.default ?? '']))
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
        <Button size="xs" leftSection={<IconPlayerPlay size={14} />} onClick={() => act('start', type.linked === 'start' ? { ...defaults, ...testInput } : {})}>Start</Button>
        <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} onClick={() => act('stop')}>Stop</Button>
        <Button size="xs" variant="default" leftSection={<IconX size={14} />} onClick={() => act('cancel')}>Cancel</Button>
      </Group>
    </>
  )
}
