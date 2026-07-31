/**
 * Shared Playwright test fixtures.
 *
 * Every spec must import `test`/`expect` from this module instead of from
 * '@playwright/test'. That is what wires in automatic frontend coverage collection —
 * a spec importing '@playwright/test' directly still passes, but its coverage is lost.
 *
 * When COVERAGE is not 'true' this is a transparent re-export with zero overhead.
 */
import { test as base, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const COVERAGE_ENABLED = process.env.COVERAGE === 'true'
const OUTPUT_DIR = path.resolve(import.meta.dirname, '../coverage/e2e-frontend')

// Istanbul's counters live in the page, so they reset on every document load. The
// beforeunload hook flushes them before a navigation throws them away; the fixture
// teardown catches whatever the final document accumulated.
declare global {
  interface Window {
    __coverage__?: unknown
    __saveIstanbulCoverage__?: (json: string | null) => void
  }
}

let sequence = 0

function writeCoverage(json: string | null): void {
  if (!json || json === 'null') return
  const file = path.join(OUTPUT_DIR, `playwright-${process.pid}-${sequence++}.json`)
  writeFileSync(file, json, 'utf8')
}

export const test = base.extend<{ frontendCoverage: void }>({
  frontendCoverage: [
    async ({ page }, use) => {
      if (!COVERAGE_ENABLED) {
        await use()
        return
      }

      mkdirSync(OUTPUT_DIR, { recursive: true })

      await page.exposeFunction('__saveIstanbulCoverage__', writeCoverage)
      await page.addInitScript(() => {
        window.addEventListener('beforeunload', () => {
          window.__saveIstanbulCoverage__?.(JSON.stringify(window.__coverage__ ?? null))
        })
      })

      await use()

      // Flush the still-open document(s). Popups and tabs count too.
      for (const openPage of page.context().pages()) {
        const json = await openPage
          .evaluate(() => JSON.stringify(window.__coverage__ ?? null))
          .catch(() => null)
        writeCoverage(json)
      }
    },
    { auto: true },
  ],
})

export { expect }
