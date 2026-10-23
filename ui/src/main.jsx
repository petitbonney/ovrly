// UI entry: mounts the app inside Mantine's provider, with the editor theme picked in Settings (themes.js), kept by
// this browser, and compact list rows.
import { useLayoutEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.jsx'
import themes from './themes.js'
import './app.css'

const components = { NavLink: { defaultProps: { py: 4 } } }

function Root() {
  const [name, setName] = useState(() => {
    try { return themes[localStorage.getItem('ovrly-theme')] ? localStorage.getItem('ovrly-theme') : 'ovrly' } catch { return 'ovrly' }
  })
  const pick = (next) => {
    try { localStorage.setItem('ovrly-theme', next) } catch {}
    setName(next)
  }
  const { scheme, theme: overrides, vars } = themes[name]
  const theme = useMemo(() => createTheme({ ...overrides, components }), [name])
  // Before paint, so the graph never shows the previous theme's colors.
  useLayoutEffect(() => {
    for (const [key, value] of Object.entries(vars)) document.documentElement.style.setProperty(`--ovrly-${key}`, value)
  }, [name])
  return (
    <MantineProvider theme={theme} forceColorScheme={scheme}>
      <App theme={name} onTheme={pick} />
    </MantineProvider>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
