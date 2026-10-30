// Fire in a trigger's settings (node types with `manual`): the inputs its manual firing asks for, saved with the node
// (starting from values its settings let through, server: engine.js manualOf), Fire, and what the trigger output.
// The firing goes on as if the event had happened: the nodes after it really run.
import { useEffect, useState } from 'react'
import { Box, Button, Group, Stack, Text } from '@mantine/core'
import { IconBolt } from '@tabler/icons-react'
import { json } from './api.js'
import Fields from './Fields.jsx'
import { Value } from './Play.jsx'

// values: the inputs saved with the node; onChange(values); onFire() fires it (Workflow.jsx fireNode).
export default function Fire({ type, config, values = {}, onChange, onFire }) {
  const [manual, setManual] = useState(null) // { config, fields }
  const settings = JSON.stringify(config)
  useEffect(() => {
    fetch(`/api/nodes/${type}/manual`, json('POST', { config })).then((res) => res.json()).then(setManual, () => {})
  }, [type, settings])
  const [firing, setFiring] = useState(false)
  const [result, setResult] = useState(null) // { out, error, at }
  const fire = async () => {
    setFiring(true)
    setResult({ ...(await onFire()), at: new Date() })
    setFiring(false)
  }
  if (!manual) return null
  return (
    <Stack gap="xs">
      {Object.keys(manual.config).length > 0 && <Fields defaults={manual.config} values={values} fields={manual.fields} onChange={onChange} />}
      <Button size="xs" w="fit-content" leftSection={<IconBolt size={14} />} loading={firing} onClick={fire}>Fire</Button>
      <Text size="xs" c="dimmed">Runs the workflow from this trigger, as if this happened: the nodes after it really run.</Text>
      {result && (
        <Stack gap={6}>
          <Text size="xs" fw={500}>Result <Text span inherit c="dimmed" fw={400}>· {result.at.toLocaleTimeString()}</Text></Text>
          {result.error ? <Text size="xs" c="red">{result.error}</Text>
            : !result.out ? <Text size="xs" c="dimmed">Didn't fire: its settings filter this event out.</Text>
            : Object.entries(result.out).map(([k, v]) => (
              <Group key={k} gap="xs" wrap="nowrap" align="flex-start">
                <Text size="xs" c="dimmed" ff="monospace" w={110} style={{ flexShrink: 0 }} truncate>{`{{${k}}}`}</Text>
                <Box flex={1} miw={0}><Value name={k} value={v} /></Box>
              </Group>
            ))}
        </Stack>
      )}
    </Stack>
  )
}
