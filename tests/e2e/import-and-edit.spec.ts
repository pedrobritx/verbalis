import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

test('import a markdown file, edit a segment, confirm with Ctrl+Enter', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Import file' }).click()

  await page.setInputFiles('#import-file', FIXTURE)
  await expect(page.locator('#import-name')).toHaveValue('sample')

  // Defaults are en → es; just submit.
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(page).toHaveURL(/#\/project\//)

  const list = page.getByTestId('segment-list')
  await expect(list).toBeVisible()
  // 1 heading + 2 paragraph sentences * 2 paragraphs + 2 list items + 1 code + 2 blockquote = 10
  await expect(list.locator('[data-segment-row]')).toHaveCount(10)

  const target1 = page.getByTestId('target-1')
  await target1.click()
  await target1.fill('Translated sentence.')

  // wait for autosave to flip status to draft
  const row1Pill = list.locator('[data-segment-row]').nth(1).getByTestId('status-pill')
  await expect(row1Pill).toHaveAttribute('data-status', 'draft', { timeout: 2000 })

  await target1.press('Control+Enter')

  await expect(row1Pill).toHaveAttribute('data-status', 'translated')

  // TopBar progress reflects the confirmation.
  await expect(page.getByTestId('topbar-progress')).toContainText('1 / 10')

  // --- Phase 4: status filter narrows the visible list.
  await page.getByTestId('status-filter-translated').click()
  await expect(list.locator('[data-segment-row]')).toHaveCount(1)
  await page.getByTestId('status-filter-all').click()
  await expect(list.locator('[data-segment-row]')).toHaveCount(10)

  // --- Phase 4: Ctrl+Shift+Enter promotes translated → reviewed and back.
  await target1.click()
  await target1.press('Control+Shift+Enter')
  await expect(row1Pill).toHaveAttribute('data-status', 'reviewed')
  await target1.click()
  await target1.press('Control+Shift+Enter')
  await expect(row1Pill).toHaveAttribute('data-status', 'translated')
})
