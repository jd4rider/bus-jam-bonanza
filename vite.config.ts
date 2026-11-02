import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths keep the build portable across GitHub Pages project
  // paths, custom domains and a future Electron shell.
  base: './',
  server: { port: 5174 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
})
