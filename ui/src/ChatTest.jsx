// Run in a Chat !command node's settings: sends the trigger a test message, its first command followed by the args
// typed (split into {{args}}), from the user and role picked (the node's role at first, so it gets through), as a
// first message or not (server: /api/workflows/:id/run).
import { useState } from 'react'
import { Button, Select, Stack, Switch, Text, TextInput } from '@mantine/core'
import { IconBolt } from '@tabler/icons-react'
import { json } from './api.js'

const roles = [{ value: 'everyone', label: 'Viewer' }, { value: 'sub', label: 'Sub' }, { value: 'vip', label: 'VIP' }, { value: 'mod', label: 'Mod' }, { value: 'broadcaster', label: 'Streamer' }]

export default function ChatTest({ workflow, node, config }) {
  const [text, setText] = useState('')
  const [user, setUser] = useState('{{$vars.channel}}') // filled on the server; TestViewer when empty
  const [picked, setRole] = useState(null) // null: the node's "Who can use it"
  const [firstMessage, setFirst] = useState(false)
  const role = picked ?? config.from
  const command = `!${config.command.split('+')[0].trim().replace(/^!/, '')}`
  const args = text.trim().split(/\s+/).filter(Boolean)
  const run = () => fetch(`/api/workflows/${workflow}/run?node=${node}`, json('POST', {
    text,
    data: {
      user, firstMessage, broadcaster: role === 'broadcaster', mod: role === 'mod',
      vip: role === 'vip', sub: role === 'sub', subMonths: role === 'sub' ? 1 : 0,
    },
  }))
  return (
    <Stack gap="sm" maw={420}>
      <TextInput size="xs" label="Args" placeholder="red 3" value={text} onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && run()} />
      <TextInput size="xs" label="User" value={user} onChange={(e) => setUser(e.currentTarget.value)} />
      <Select size="xs" label="Role" data={roles} value={role} onChange={setRole} allowDeselect={false} />
      <Switch size="xs" label="First message" checked={firstMessage} onChange={(e) => setFirst(e.currentTarget.checked)} />
      <Button size="xs" w="fit-content" leftSection={<IconBolt size={14} />} onClick={run}>Run</Button>
      <Text size="xs" c="dimmed">
        Sends "{[command, ...args].join(' ')}" from {user.trim() || 'TestViewer'}{args.length > 0 && <>: {'{{args}}'} is {args.join(', ')}</>}.
      </Text>
    </Stack>
  )
}
