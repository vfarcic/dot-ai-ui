import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Vitest config for the unit-test layer.
 *
 * Deliberately standalone (Vitest ignores vite.config.ts when this file exists) so the
 * env-gated vite-plugin-istanbul in vite.config.ts never double-instruments unit runs.
 *
 * Coverage uses the *istanbul* provider, not v8, on purpose: E2E browser coverage is
 * collected with babel-plugin-istanbul (via vite-plugin-istanbul), and merging two
 * different instrumentations of the same file yields incompatible statement maps and
 * therefore garbage merged numbers. Same provider on both layers => a valid merge.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Only unit tests. Playwright owns e2e/*.spec.ts — never let Vitest load those.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'istanbul',
      reportsDirectory: './coverage/unit',
      // json => coverage-final.json, the istanbul-format input the merge step consumes.
      reporter: ['text-summary', 'json'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/api/generated/**',
        'src/types/**',
        'src/**/index.ts',
      ],
    },
  },
})
