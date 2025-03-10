import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: true,
  },
  server: {
    allowedHosts: ['all'],
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
    cors: false,
    host: '0.0.0.0',
    strictPort: false,
  },
})
