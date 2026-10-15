// UI entry: mounts the app inside Mantine's provider (dark theme).
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.jsx'
import './app.css'

createRoot(document.getElementById('root')).render(
  <MantineProvider forceColorScheme="dark">
    <App />
  </MantineProvider>,
)
