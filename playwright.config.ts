import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

// Use a dedicated port for E2E tests so they never conflict with a running dev server.
// Two webServers: mock API (port 3001) starts first, then the dev server (port 3002).
// This ensures the mock is ready for OAuth client registration on dev server startup.
const TEST_PORT = 3002
const MOCK_PORT = 3001

// Coverage mode (`npm run test:e2e:coverage`): COVERAGE=true makes vite.config.ts
// instrument the frontend with istanbul, and NODE_V8_COVERAGE makes Node dump raw V8
// profiles for the Express server. See scripts/coverage-report.mjs for the reporting side.
const coverageEnabled = process.env.COVERAGE === 'true'
const coverageEnv = coverageEnabled
  ? {
      COVERAGE: 'true',
      NODE_V8_COVERAGE: path.resolve(import.meta.dirname, 'coverage/server-v8'),
    }
  : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'docker compose -f e2e/docker-compose.yml up',
      url: `http://localhost:${MOCK_PORT}/api/v1/users`,
      reuseExistingServer: false,
      timeout: 60000,
      // Playwright SIGKILLs web servers by default, which leaves the container running
      // and makes the next run fail with "port 3001 is already used".
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
    },
    {
      // Use tsx without watch to prevent server restarts when test-results/ files are written.
      // `node --import tsx` (not `npx tsx`) so the server is this process's direct child and
      // receives the shutdown signal without an npx wrapper in between.
      command: 'node --import tsx server/index.ts',
      url: `http://localhost:${TEST_PORT}`,
      reuseExistingServer: false,
      timeout: 120000,
      // Required for server coverage: V8 writes its profile only on a clean exit, and
      // Playwright's default is SIGKILL. Also lets in-flight requests finish.
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
      env: {
        PORT: String(TEST_PORT),
        DOT_AI_MCP_URL: `http://localhost:${MOCK_PORT}`,
        DOT_AI_UI_AUTH_TOKEN: 'test-token',
        ...coverageEnv,
      },
    },
  ],
})
