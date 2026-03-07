import { defineConfig, devices } from '@playwright/test'

// Use a dedicated port for E2E tests so they never conflict with a running dev server.
// Two webServers: mock API (port 3001) starts first, then the dev server (port 3002).
// This ensures the mock is ready for OAuth client registration on dev server startup.
const TEST_PORT = 3002
const MOCK_PORT = 3001

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
    },
    {
      // Use tsx without watch to prevent server restarts when test-results/ files are written
      command: 'npx tsx server/index.ts',
      url: `http://localhost:${TEST_PORT}`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        PORT: String(TEST_PORT),
        DOT_AI_MCP_URL: `http://localhost:${MOCK_PORT}`,
        DOT_AI_UI_AUTH_TOKEN: 'test-token',
      },
    },
  ],
})
