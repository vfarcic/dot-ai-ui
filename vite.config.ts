import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import istanbul from 'vite-plugin-istanbul'
import path from 'path'

// Instrument the app for coverage only when COVERAGE=true (set by `npm run test:e2e:coverage`).
// The E2E dev server runs this config through Vite middleware mode, so instrumented
// modules are served to the browser and E2E tests can harvest window.__coverage__.
// Never enabled for normal dev or production builds — it slows transforms measurably.
const coverageEnabled = process.env.COVERAGE === 'true'

// https://vite.dev/config/
export default defineConfig({
  envPrefix: 'DOT_AI_',
  plugins: [
    react(),
    tailwindcss(),
    ...(coverageEnabled
      ? [
          istanbul({
            include: 'src/*',
            exclude: ['node_modules', 'e2e', 'src/**/*.test.*', 'src/test/**'],
            extension: ['.ts', '.tsx'],
            requireEnv: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Mermaid.js dependencies are large but gzip well
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
