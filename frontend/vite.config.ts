import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The API uses a cookie for identity, so the dev server proxies /api to the backend
// on the same origin instead of relying on CORS. API_TARGET can point elsewhere,
// for example at a stopped port to exercise the network error state.
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8765'

export default defineConfig({
  plugins: [react()],
  build: {
    // FastAPI serves the project-level web/ folder at /.
    outDir: fileURLToPath(new URL('../web', import.meta.url)),
    emptyOutDir: true,
    // Keep every font subset as a file so unicode-range loads only the ones in use.
    assetsInlineLimit: 0,
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
  },
})
