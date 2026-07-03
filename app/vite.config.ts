import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Allow tunnel hosts during dev (T15 verification)
    // This project lives in a OneDrive folder, where native file events don't
    // reach Vite's watcher — so edits never triggered HMR and the browser kept
    // serving stale modules. Polling forces Vite to detect changes reliably.
    watch: { usePolling: true, interval: 200 },
  },
})
