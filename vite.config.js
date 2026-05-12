import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/layout':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/kpis':      { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/analytics': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/source':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/stream':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/twins':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/share':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws':        { target: 'ws://127.0.0.1:8000', ws: true, changeOrigin: true },
    },
  },
})

