/**
 * Vitest setup: runs once per test file before the tests in it.
 * Adds jest-dom matchers (toBeInTheDocument, toHaveClass, ...) and unmounts
 * React trees between tests so component tests stay isolated.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
