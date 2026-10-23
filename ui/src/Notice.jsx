// A note in node settings, one style for all: yellow when something won't run yet, red when it's broken. settings: the
// Settings pane that fixes it, linked at the end.
import { Alert, Anchor } from '@mantine/core'
import { openSettings } from './Settings.jsx'

export default function Notice({ color = 'yellow', settings, children }) {
  return (
    <Alert variant="light" color={color} p="xs" maw={420} styles={{ message: { fontSize: 'var(--mantine-font-size-xs)' } }}>
      {children}
      {settings && <>{' '}<Anchor component="button" type="button" size="xs" onClick={() => openSettings(settings)}>Open settings</Anchor></>}
    </Alert>
  )
}
