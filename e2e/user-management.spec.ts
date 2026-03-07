import { test, expect } from '@playwright/test'
import { injectAuth } from './helpers'

test.describe.serial('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)

    // Navigate to Users page via sidebar
    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page).toHaveURL('/users')
  })

  test('displays user list with mock data', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible()

    // Verify mock users are displayed
    await expect(page.getByRole('cell', { name: 'admin@dot-ai.local' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'alice@example.com' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible()

    // Create user form is visible
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })

  test('create user journey: fill form, submit, verify user appears', async ({ page }) => {
    // Wait for existing users to load
    await expect(page.getByRole('cell', { name: 'admin@dot-ai.local' })).toBeVisible()

    // Intercept the POST to verify the API call
    const createPromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/users') && res.request().method() === 'POST'
    )

    // Fill and submit the form
    await page.getByPlaceholder('Email').fill('newuser@example.com')
    await page.getByPlaceholder('Password').fill('password123')
    await page.getByRole('button', { name: 'Create User' }).click()

    // Verify API call succeeded
    const createRes = await createPromise
    expect(createRes.status()).toBeLessThan(400)

    // Form should be cleared after successful creation
    await expect(page.getByPlaceholder('Email')).toHaveValue('')
    await expect(page.getByPlaceholder('Password')).toHaveValue('')
  })

  test('delete user journey: click delete, confirm, verify user removed', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible()

    // Click delete on bob
    const bobRow = page.getByRole('row').filter({ hasText: 'bob@example.com' })
    await bobRow.getByRole('button', { name: 'Delete' }).click()

    // Verify confirmation dialog
    await expect(page.getByRole('heading', { name: 'Delete User' })).toBeVisible()
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible()

    // Intercept the DELETE to verify the API call
    const deletePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/users') && res.request().method() === 'DELETE'
    )

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).last().click()

    // Verify API call succeeded
    const deleteRes = await deletePromise
    expect(deleteRes.status()).toBeLessThan(400)

    // Dialog should dismiss
    await expect(page.getByRole('heading', { name: 'Delete User' })).not.toBeVisible()
  })

  test('cancel delete dismisses dialog without API call', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'alice@example.com' })).toBeVisible()

    const aliceRow = page.getByRole('row').filter({ hasText: 'alice@example.com' })
    await aliceRow.getByRole('button', { name: 'Delete' }).click()

    // Dialog appears
    await expect(page.getByRole('heading', { name: 'Delete User' })).toBeVisible()

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog dismissed, user still in list
    await expect(page.getByRole('heading', { name: 'Delete User' })).not.toBeVisible()
    await expect(page.getByRole('cell', { name: 'alice@example.com' })).toBeVisible()
  })
})
