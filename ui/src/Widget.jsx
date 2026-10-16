// Widget instance settings, shown in a widget node's settings pane: id, name, OBS link, settings, test and preview.
// Autosaved; the instance itself is created when its widget is dropped onto the graph.
import { useEffect, useState } from 'react'
import { ActionIcon, Alert, Anchor, Button, Code, CopyButton, Divider, Group, SegmentedControl, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconHourglassHigh } from '@tabler/icons-react'
import Fields from './Fields.jsx'
import Heading from './Heading.jsx'
import { get, json } from './api.js'

// Fires one widget action by hand, like a widget node would. The value box only shows for actions that take one.
function Test({ widget, type }) {
  const [action, setAction] = useState(type.actions[0])
  const [value, setValue] = useState('')
  const [user, setUser] = useState('tester')
  const [error, setError] = useState('')
  const send = async (e) => {
    e.preventDefault()
    const res = await fetch(`/api/widgets/${widget.id}/action`, json('POST', { action, value, user }))
    setError(res.ok ? '' : (await res.json()).error)
  }
  return (
    <form onSubmit={send}>
      <Heading title="Test" />
      <Group gap="xs">
        {type.actions.length > 1 && <SegmentedControl size="xs" data={type.actions} value={action} onChange={setAction} />}
        {type.inputs?.[action] && <TextInput size="xs" w={120} placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />}
        <TextInput size="xs" w={100} placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} />
        <Button size="xs" variant="default" type="submit">Send</Button>
      </Group>
      {error && <Text size="xs" c="red" mt={4}>{error}</Text>}
    </form>
  )
}

// A widget node's settings, in sections: the instance's id and name, its settings, then its test. A widget type marked
// `soon` shows a "Coming soon" note instead of settings and test. onCopy copies the node for pasting.
export default function WidgetSettings({ widget, type, onChange, onCopy }) {
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
        {/* A widget's mode (e.g. chat votes or a Twitch poll) shapes everything below, so it comes first. */}
        {!type.soon && 'mode' in type.config && (
          <Fields defaults={type.config} fields={type.fields} values={config} onChange={setConfig} context={{ streamer }} show={['mode']} />
        )}
        <Divider />
        {type.soon ? (
          <Alert variant="light" color="yellow" icon={<IconHourglassHigh size={18} />} title="Coming soon">
            This widget is a work in progress: its settings will come in a later version.
          </Alert>
        ) : (
          <>
            <Fields defaults={type.config} fields={type.fields} values={config} onChange={setConfig} context={{ streamer }}
              show={Object.keys(type.config).filter((key) => key !== 'mode')} />
            <Divider />
            <Test widget={widget} type={type} />
          </>
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
        <div className="preview-fit"><iframe className="preview" src={url} title="Preview" /></div>
      </Stack>
    </Group>
  )
}
