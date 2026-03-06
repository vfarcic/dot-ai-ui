import { execSync } from 'child_process'

export default async function globalTeardown() {
  console.log('[E2E] Stopping mock server...')
  execSync('docker compose -f e2e/docker-compose.yml down', { stdio: 'inherit' })
  console.log('[E2E] Mock server stopped')
}
