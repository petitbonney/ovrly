// Test in a Code node's settings: runs its code once (POST /api/code/test) on input data, at first what the node got on
// its last run (from the engine's run history; one of the recent runs can be picked), and shows what it returns or
// throws, and what it logs. The variables it changes are a copy: they stay as they are.
import { useEffect, useState } from 'react'
import { Button, Code, Group, JsonInput, Menu, Stack, Text } from '@mantine/core'
import { IconHistory, IconPlayerPlay } from '@tabler/icons-react'
import { get, json } from './api.js'

const pretty = (v) => JSON.stringify(v, null, 2)
const parse = (text) => {
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch { return null }
}

export default function CodeTest({ workflow, node, config }) {
  const [input, setInput] = useState('{}')
  const [runs, setRuns] = useState([]) // [{ at, input }]: this node's input in the recent runs, newest first
  const [result, setResult] = useState(null) // { out, error, logs, ms }
  const [running, setRunning] = useState(false)
  useEffect(() => {
    get(`/api/runs?workflow=${workflow}`).then((all) => {
      const got = all.flatMap((r) => r.nodes.filter((n) => n.node === node).slice(-1).map((n) => ({ at: new Date(r.at), input: n.input })))
      setRuns(got)
      if (got.length) setInput(pretty(got[0].input))
    }, () => {})
  }, [workflow, node])
  const data = parse(input)
  const run = async () => {
    setRunning(true)
    setResult(await fetch('/api/code/test', json('POST', { code: config.code, data }))
      .then((res) => (res.ok ? res.json() : { error: res.statusText }), (err) => ({ error: err.message })))
    setRunning(false)
  }
  return (
    <Stack gap="sm">
      <JsonInput size="xs" label="Input data" value={input} onChange={setInput} autosize minRows={4} maxRows={10}
        error={!data && 'A JSON object'} onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && data && run()}
        description={runs.length ? 'What it got on its last run.' : 'It hasn\'t run yet: type some.'} />
      <Group gap="xs">
        <Button size="xs" leftSection={<IconPlayerPlay size={14} />} loading={running} disabled={!data} onClick={run}>Test</Button>
        {runs.length > 1 && (
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <Button size="xs" variant="default" leftSection={<IconHistory size={14} />}>Recent runs</Button>
            </Menu.Target>
            <Menu.Dropdown mah={240} style={{ overflow: 'auto' }}>
              {runs.map((r, i) => <Menu.Item key={i} onClick={() => setInput(pretty(r.input))}>{r.at.toLocaleTimeString()}</Menu.Item>)}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      <Text size="xs" c="dimmed">Variables it changes stay as they are; anything else it does (fetch…) is real.</Text>
      {result && (
        <Stack gap={6}>
          <Text size="xs" fw={500}>{result.error ? 'Error' : 'Output'}{result.ms != null && <Text span inherit c="dimmed" fw={400}> · {result.ms} ms</Text>}</Text>
          {result.error ? <Text size="xs" c="red">{result.error}</Text>
            : result.out === null ? <Text size="xs" c="dimmed">Null: the workflow stops here.</Text>
            : <Code block mah={240} style={{ overflow: 'auto' }}>{pretty(result.out)}</Code>}
          {result.logs?.length > 0 && (
            <>
              <Text size="xs" fw={500}>Console</Text>
              <Code block mah={160} style={{ overflow: 'auto' }}>
                {result.logs.map((l, i) => <Text key={i} span inherit display="block" c={l.level === 'error' ? 'red' : l.level === 'warn' ? 'yellow' : undefined}>{l.text}</Text>)}
              </Code>
            </>
          )}
        </Stack>
      )}
    </Stack>
  )
}
