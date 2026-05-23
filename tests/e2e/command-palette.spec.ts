import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

test('command palette: open via Ctrl+K and navigate to TM', async ({ page }) => {
  await page.goto('/')

  // Palette starts closed.
  await expect(page.getByTestId('cmd-input')).toHaveCount(0)

  await page.keyboard.press('Control+K')
  await expect(page.getByTestId('cmd-input')).toBeVisible()

  await page.getByTestId('cmd-nav-tm').click()
  await expect(page).toHaveURL(/#\/tm$/)
  await expect(page.getByTestId('cmd-input')).toHaveCount(0)
})

test('command palette: in-editor actions mark current segment reviewed', async ({ page }) => {
  await page.goto('/')

  // Create a project so the editor is reachable.
  await page.getByRole('button', { name: 'Import file' }).click()
  await page.setInputFiles('#import-file', FIXTURE)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/#\/project\//)

  // Open palette and toggle review mode.
  await page.keyboard.press('Control+K')
  await page.getByTestId('cmd-toggle-review-mode').click()
  await expect(page.getByTestId('review-mode-toggle')).toHaveAttribute('aria-pressed', 'true')

  // Mark the current (first, focused-by-default) segment reviewed.
  await page.keyboard.press('Control+K')
  await page.getByTestId('cmd-mark-reviewed').click()

  const firstPill = page.locator('[data-segment-row]').first().getByTestId('status-pill')
  await expect(firstPill).toHaveAttribute('data-status', 'reviewed')
})
