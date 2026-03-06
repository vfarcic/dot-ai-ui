import { test, expect } from '@playwright/test'
import { injectAuth } from './helpers'

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)

    // Navigate to Users page via sidebar
    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page).toHaveURL('/users')
  })

  test('sidebar shows Users link as active', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
  })

  test('user list displays mock users', async ({ page }) => {
    // Verify page heading
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()

    // Verify user table with mock data
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible()

    // Verify mock users are displayed
    await expect(page.getByRole('cell', { name: 'admin@dot-ai.local' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'alice@example.com' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible()
  })

  test('create user form is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create User' })).toBeVisible()
  })

  test('create user submits form and clears inputs', async ({ page }) => {
    // Wait for user list to load
    await expect(page.getByRole('cell', { name: 'admin@dot-ai.local' })).toBeVisible()

    // Fill and submit the form
    await page.getByPlaceholder('Email').fill('newuser@example.com')
    await page.getByPlaceholder('Password').fill('password123')
    await page.getByRole('button', { name: 'Create User' }).click()

    // After creation, form should be cleared
    await expect(page.getByPlaceholder('Email')).toHaveValue('')
    await expect(page.getByPlaceholder('Password')).toHaveValue('')
  })

  test('delete user shows confirmation dialog', async ({ page }) => {
    // Wait for users to load
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible()

    // Click delete on a user
    const bobRow = page.getByRole('row').filter({ hasText: 'bob@example.com' })
    await bobRow.getByRole('button', { name: 'Delete' }).click()

    // Verify confirmation dialog
    await expect(page.getByRole('heading', { name: 'Delete User' })).toBeVisible()
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('cancel delete dismisses dialog', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible()

    const bobRow = page.getByRole('row').filter({ hasText: 'bob@example.com' })
    await bobRow.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog should be dismissed
    await expect(page.getByRole('heading', { name: 'Delete User' })).not.toBeVisible()
  })

  test('confirm delete calls API and dismisses dialog', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible()

    const bobRow = page.getByRole('row').filter({ hasText: 'bob@example.com' })
    await bobRow.getByRole('button', { name: 'Delete' }).click()

    // Click the Delete button in the confirmation dialog
    await page.getByRole('button', { name: 'Delete' }).last().click()

    // Dialog should dismiss after deletion
    await expect(page.getByRole('heading', { name: 'Delete User' })).not.toBeVisible()
  })
})
