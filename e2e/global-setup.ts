import { execSync } from 'child_process'

export default async function globalSetup() {
  console.log('[E2E] Starting mock server...')
  execSync('docker compose -f e2e/docker-compose.yml up -d --wait', { stdio: 'inherit' })
  console.log('[E2E] Mock server ready')
}
