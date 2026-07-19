import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTarget } from './helpers/richEditor'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

async function importSample(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => indexedDB.deleteDatabase('verbalis'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Import file' }).click()
  await page.setInputFiles('#import-file', FIXTURE)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/#\/project\//)
  await expect(page.getByTestId('segment-list')).toBeVisible()
}

test('document preview assembles the translated document and jumps to a segment', async ({
  page,
}) => {
  await importSample(page)

  // A monolingual (MD) import has a document tree, so the preview toggle appears.
  await page.getByTestId('preview-toggle').click()
  await expect(page.getByTestId('document-preview')).toBeVisible()

  // Translate the first paragraph sentence; the preview updates live.
  await setTarget(page, 1, 'Hola mundo')
  await expect(page.getByTestId('preview-body')).toContainText('Hola mundo')

  // Clicking the block focuses its first segment in the editor below.
  const block = page
    .getByTestId('preview-body')
    .getByTestId('preview-block')
    .filter({ hasText: 'Hola mundo' })
    .first()
  await block.click()
  await expect(page.locator('[data-segment-index="1"][data-focused="true"]')).toBeVisible()

  // The Source mode shows original text.
  await page.getByTestId('preview-mode-source').click()
  await expect(page.getByTestId('preview-body')).not.toContainText('Hola mundo')
})
