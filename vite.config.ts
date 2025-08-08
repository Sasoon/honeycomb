import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          dictionary: ['/src/lib/words_dictionary.json'],
          tetris: ['/src/pages/TetrisGame.tsx'],
          daily: ['/src/pages/DailyChallenge.tsx'],
          stats: ['/src/pages/Stats.tsx'],
          howto: ['/src/pages/HowToPlay.tsx']
        }
      }
    }
  }
})
