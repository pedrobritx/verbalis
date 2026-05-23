import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MD_FIXTURE = path.resolve(HERE, 'fixtures/sample.md')
const CSV_FIXTURE = path.resolve(HERE, 'fixtures/sample-glossary.csv')
const TBX_FIXTURE = path.resolve(HERE, 'fixtures/sample-glossary.tbx')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('verbalis')
  })
})

test('glossary CSV import populates the management page', async ({ page }) => {
  await page.goto('/#/terminology')
  await page.setInputFiles('[data-testid="glossary-import-input"]', CSV_FIXTURE)
  await expect(page.getByTestId('glossary-import-status')).toContainText('Imported')
  // CSV has 2 distinct terms (sentence, paragraph) after merging rows.
  await expect(page.getByTestId('glossary-row')).toHaveCount(2)
})

test('glossary TBX import populates the management page', async ({ page }) => {
  await page.goto('/#/terminology')
  await page.setInputFiles('[data-testid="glossary-import-input"]', TBX_FIXTURE)
  await expect(page.getByTestId('glossary-import-status')).toContainText('Imported')
  await expect(page.getByTestId('glossary-row')).toHaveCount(2)
})

test('CSV export download triggers from the management page', async ({ page }) => {
  await page.goto('/#/terminology')
  await page.setInputFiles('[data-testid="glossary-import-input"]', CSV_FIXTURE)
  await expect(page.getByTestId('glossary-row')).toHaveCount(2)

  await page.getByTestId('glossary-export-button').click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('glossary-export-csv').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
})

test('a glossary term is surfaced in the editor and can be inserted', async ({ page }) => {
  // Import a project so we have a segment containing the term "paragraph".
  await page.goto('/')
  await page.getByRole('button', { name: 'Import file' }).click()
  await page.setInputFiles('#import-file', MD_FIXTURE)
  await page.locator('#import-name').fill('Glossary E2E')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/#\/project\//)

  // Seed the glossary via the management page.
  await page.goto('/#/terminology')
  await page.setInputFiles('[data-testid="glossary-import-input"]', CSV_FIXTURE)
  await expect(page.getByTestId('glossary-row')).toHaveCount(2)

  // Back to the project: open the segment whose source contains "paragraph".
  await page.goto('/')
  await page.getByRole('link', { name: 'Glossary E2E' }).click()
  await expect(page).toHaveURL(/#\/project\//)

  // Focus the first paragraph sentence (index 1 in the sample fixture).
  const target = page.getByTestId('target-1')
  await target.click()

  // Switch the sidebar to the Glossary tab.
  await page.getByTestId('sidebar-tab-glossary').click()
  const glossaryPanel = page.getByTestId('glossary-panel')
  await expect(glossaryPanel).toBeVisible()
  const hit = page.getByTestId('glossary-hit-0')
  await expect(hit).toBeVisible()
  await expect(hit).toContainText('paragraph')

  await target.focus()
  await page.getByTestId('glossary-insert-0').click()
  await expect(target).toHaveValue(/párrafo/)
})
