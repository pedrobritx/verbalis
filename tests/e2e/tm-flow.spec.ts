import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { targetEditor, setTarget, expectTargetText } from './helpers/richEditor'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MD_FIXTURE = path.resolve(HERE, 'fixtures/sample.md')
const TMX_FIXTURE = path.resolve(HERE, 'fixtures/sample.tmx')

async function importSample(page: import('@playwright/test').Page, name: string) {
  await page.goto('/')
  // Clear stored state by deleting the IndexedDB on first call.
  await page.getByRole('button', { name: 'Import file' }).click()
  await page.setInputFiles('#import-file', MD_FIXTURE)
  await page.locator('#import-name').fill(name)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/#\/project\//)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('verbalis')
  })
})

test('TM auto-populates on confirm and surfaces matches in a second project', async ({ page }) => {
  // Project 1: translate the first paragraph sentence.
  await importSample(page, 'first')
  const target1 = targetEditor(page, 1)
  await setTarget(page, 1, 'Frase traducida uno.')
  await target1.press('Control+Enter')

  const row1Pill = page
    .getByTestId('segment-list')
    .locator('[data-segment-row]')
    .nth(1)
    .getByTestId('status-pill')
  await expect(row1Pill).toHaveAttribute('data-status', 'translated')

  // Project 2: same source content, expect a 100% match in the panel.
  await importSample(page, 'second')

  // Focus the segment with the same source.
  const target1B = targetEditor(page, 1)
  await target1B.click()

  const panel = page.getByTestId('tm-panel')
  await expect(panel).toBeVisible()
  const firstMatch = panel.getByTestId('tm-match-0')
  await expect(firstMatch).toBeVisible()
  await expect(firstMatch).toHaveAttribute('data-tm-score', '100')
  await expect(firstMatch).toContainText('Frase traducida uno.')

  // Apply via Ctrl+1.
  await target1B.focus()
  await page.keyboard.press('Control+1')
  await expectTargetText(page, 1, 'Frase traducida uno.')

  // Status should become draft (was untranslated).
  const row1BPill = page
    .getByTestId('segment-list')
    .locator('[data-segment-row]')
    .nth(1)
    .getByTestId('status-pill')
  await expect(row1BPill).toHaveAttribute('data-status', 'draft')
})

test('TM management page lists entries and exports TMX', async ({ page }) => {
  await importSample(page, 'first')
  const target1 = targetEditor(page, 1)
  await setTarget(page, 1, 'Salida exportada.')
  await target1.press('Control+Enter')

  // Wait for the TM write to complete before navigating away.
  await page
    .getByTestId('segment-list')
    .locator('[data-segment-row]')
    .nth(1)
    .getByTestId('status-pill')
    .waitFor()

  await page.goto('/#/tm')
  const rows = page.getByTestId('tm-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Salida exportada.')

  // Export.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('tm-export-button').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.tmx$/)
})

test('TMX import adds entries to TM', async ({ page }) => {
  await page.goto('/#/tm')
  await page.setInputFiles('[data-testid="tm-import-input"]', TMX_FIXTURE)
  await expect(page.getByTestId('tm-import-status')).toContainText('Imported 2 entries')
  await expect(page.getByTestId('tm-row')).toHaveCount(2)
})
