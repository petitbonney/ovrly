// Widget instance settings, shown in a widget node's settings pane: name, OBS link, settings, test and live preview.
// Autosaved; the instance itself is created when its widget is dropped onto the graph.
import { useEffect, useState } from 'react'
import { ActionIcon, Anchor, Box, Button, CopyButton, Group, SegmentedControl, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import Fields from './Fields.jsx'
import Heading from './Heading.jsx'

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// Fires one widget action by hand, like a widget node would.
function Test({ widget, type }) {
  const [action, setAction] = useState(type.actions[0])
  const [value, setValue] = useState('')
  const [user, setUser] = useState('tester')
  const send = (e) => {
    e.preventDefault()
    fetch(`/api/widgets/${widget.id}/action`, json('POST', { action, value, user }))
  }
  return (
    <form onSubmit={send}>
      <Heading title="Test" />
      <Group gap="xs">
        {type.actions.length > 1 && <SegmentedControl size="xs" data={type.actions} value={action} onChange={setAction} />}
        <TextInput size="xs" w={120} placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
        <TextInput size="xs" w={100} placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} />
        <Button size="xs" variant="default" type="submit">Send</Button>
      </Group>
    </form>
  )
}

// children: the node's own settings (action, value), shown above the widget's.
export default function WidgetSettings({ widget, type, onChange, children }) {
  const [name, setName] = useState(widget.name)
  const [config, setConfig] = useState(widget.config)
  const [error, setError] = useState(null)

  // Debounced autosave; the server pushes the new config to open overlays and refuses a name already in use.
  useEffect(() => {
    if (name === widget.name && config === widget.config) return
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/widgets/${widget.id}`, json('PUT', { name, type: widget.type, config }))
      setError(res.ok ? null : (await res.json()).error)
      if (res.ok) onChange()
    }, 500)
    return () => clearTimeout(timer)
  }, [name, config])

  const url = `${location.origin}/w/${widget.id}`
  return (
    // The preview sits beside the settings, or below them when the pane is narrow.
    <Group align="start" gap="xl">
      <Stack gap="md" flex="1 1 280px" maw={420}>
        {children}
        <TextInput size="xs" label="Widget name" description="Shared by every node that uses this widget" value={name} error={error} onChange={(e) => setName(e.target.value)} />
        <Fields defaults={type.config} values={config} onChange={setConfig} />
        <Test widget={widget} type={type} />
      </Stack>
      <Box flex="1 1 320px" miw={0}>
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
        <iframe className="preview" src={url} title="Preview" />
      </Box>
    </Group>
  )
}
