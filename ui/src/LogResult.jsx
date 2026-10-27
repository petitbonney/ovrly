// A Log node's result, shown in its settings: the data it got on its last run (from the engine's run history), updated
// each time it runs again.
import { useEffect, useState } from 'react'
import { Code, Stack, Text } from '@mantine/core'
import { get } from './api.js'

export default function LogResult({ workflow, node }) {
  const [last, setLast] = useState(null) // { data, at }
  useEffect(() => {
    // Runs come newest first, and a run's nodes in the order they ran.
    const load = () => get(`/api/runs?workflow=${workflow}`).then((runs) => {
      for (const run of runs) {
        const n = run.nodes.findLast((n) => n.node === node)
        if (n) return setLast({ data: n.input, at: new Date(run.at) })
      }
    }, () => {})
    load()
    // The shared activity stream (App.jsx).
    const onActivity = ({ detail: a }) => a.workflow === workflow && a.node === node && a.state === 'done' && load()
    window.addEventListener('ovrly-activity', onActivity)
    return () => window.removeEventListener('ovrly-activity', onActivity)
  }, [workflow, node])
  return (
    <Stack gap={6}>
      <Text size="xs" fw={500}>Result{last && <Text span inherit c="dimmed" fw={400}> · {last.at.toLocaleTimeString()}</Text>}</Text>
      {last ? <Code block mah={320} style={{ overflow: 'auto' }}>{JSON.stringify(last.data, null, 2)}</Code>
        : <Text size="xs" c="dimmed">Not run yet: the data it gets shows here.</Text>}
    </Stack>
  )
}
