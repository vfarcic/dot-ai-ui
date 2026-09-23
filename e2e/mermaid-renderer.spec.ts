import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { injectAuth } from './helpers'

const SESSION_ID = 'qry-mermaid-e2e'

/**
 * Diagram with a collapsible subgraph plus attacker-authored interaction directives of every
 * flavour: javascript: link, href to javascript:, callback into an arbitrary window function,
 * `call` with arguments, and one hidden behind an inline %%{init}%% directive.
 */
const DIAGRAM = [
  'graph TD',
  '  subgraph services[Services Layer]',
  '    api[API Server] --> db[(Database)]',
  '  end',
  '  user[User]',
  '  evil[Click me]',
  '  user --> api',
  '  evil --> user',
  '  click evil "javascript:void(window.__xssFired=\'link\')"',
  '  click user href "javascript:void(window.__xssFired=\'href\')"',
  '  click evil __xssCallback "tooltip"',
  '  click user call __xssCallback("call")',
  '%%{init: {"theme": "dark"}}%%click evil call __xssCallback("directive")',
].join('\n')

async function openDiagram(page: Page) {
  await injectAuth(page)
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.__xssFired = null
    // A pre-existing global function an attacker might target with a click callback
    w.__xssCallback = (arg: unknown) => {
      w.__xssFired = `callback:${String(arg)}`
    }
  })
  await page.route(`**/api/v1/visualize/${SESSION_ID}*`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          title: 'Mermaid E2E',
          visualizations: [{ id: 'diagram', label: 'Architecture', type: 'mermaid', content: DIAGRAM }],
        },
      },
    }),
  )
  await page.goto(`/v/${SESSION_ID}`)
  return page.locator('svg[id^="mermaid-"]')
}

test.describe('Mermaid renderer', () => {
  test('collapsed subgraph expands on click and collapses via its header', async ({ page }) => {
    const diagram = await openDiagram(page)

    const placeholder = diagram.getByText('▶ Services Layer • 2 items')
    await expect(placeholder).toBeVisible({ timeout: 15000 })
    await expect(diagram.getByText('API Server')).toHaveCount(0)

    // Placeholders are made clickable by the renderer itself (no Mermaid callback)
    await expect(diagram.locator('.node.clickable')).toHaveCount(1)

    await placeholder.click()
    await expect(diagram.getByText('API Server')).toBeVisible()
    await expect(diagram.getByText('Database', { exact: true })).toBeVisible()
    const header = diagram.locator('.mermaid-collapsible-header', { hasText: 'Services Layer' })
    await expect(header).toContainText('▼')

    await header.click()
    await expect(diagram.getByText('▶ Services Layer • 2 items')).toBeVisible()
    await expect(diagram.getByText('API Server')).toHaveCount(0)
  })

  test('attacker-authored click directives do not execute', async ({ page }) => {
    const dialogs: string[] = []
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message())
      void dialog.dismiss()
    })

    const svg = await openDiagram(page)
    await expect(svg.getByText('▶ Services Layer • 2 items')).toBeVisible({ timeout: 15000 })

    await svg.getByText('Click me').click()
    await svg.getByText('User', { exact: true }).click()

    // Give any (wrongly) bound handler a chance to run before asserting nothing happened
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__xssFired)).toBeNull()
    expect(dialogs).toEqual([])
    await expect(page).toHaveURL(new RegExp(`/v/${SESSION_ID}$`))

    // No live links or inline handlers made it into the DOM
    await expect(svg.locator('a')).toHaveCount(0)
    const inlineHandlers = await svg.evaluate(
      (el) =>
        Array.from(el.querySelectorAll('*')).filter((node) =>
          Array.from(node.attributes).some(
            (attr) => attr.name.startsWith('on') || /javascript:/i.test(attr.value),
          ),
        ).length,
    )
    expect(inlineHandlers).toBe(0)
    // Only the collapsed placeholder is clickable; the directive targets are not
    await expect(svg.locator('.node.clickable')).toHaveCount(1)
  })
})
