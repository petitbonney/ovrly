// Vite config: the React UI lives in ./ui and builds to ./dist.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'ui',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
})
