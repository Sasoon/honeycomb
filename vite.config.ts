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
    target: 'es2022',
    minify: 'esbuild', // Faster than terser and uses less memory
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Web worker should be separate
          if (id.includes('dictionaryWorker')) {
            return 'worker';
          }
          // Vendor libs - split by size/usage
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('framer-motion')) {
              return 'motion-vendor';
            }
            if (id.includes('matter-js')) {
              return 'physics-vendor';
            }
            if (id.includes('zustand') || id.includes('nanoid')) {
              return 'state-vendor';
            }
            return 'vendor';
          }
          // App chunks
          if (id.includes('/src/pages/WaxleGame.tsx')) {
            return 'waxle';
          }
          if (id.includes('/src/pages/DailyChallenge.tsx')) {
            return 'daily';
          }
          if (id.includes('/src/pages/HowToPlay.tsx')) {
            return 'howto';
          }
          if (id.includes('/src/components/')) {
            return 'components';
          }
          if (id.includes('/src/store/') || id.includes('/src/lib/')) {
            return 'utils';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  }
})
