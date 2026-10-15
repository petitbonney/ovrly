// UI entry: mounts the app inside Mantine's provider (dark theme, compact list rows).
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.jsx'
import './app.css'

const theme = createTheme({
  components: { NavLink: { defaultProps: { py: 4 } } },
})

createRoot(document.getElementById('root')).render(
  <MantineProvider theme={theme} forceColorScheme="dark">
    <App />
  </MantineProvider>,
)
