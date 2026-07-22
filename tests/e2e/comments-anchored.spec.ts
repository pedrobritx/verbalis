import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { targetEditor, setTarget } from './helpers/richEditor'

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

test('comment on a selection: highlight, thread, reply, resolve', async ({ page }) => {
  await importSample(page)

  // Write target text, then select all of it to anchor a comment.
  await setTarget(page, 1, 'Hola mundo')
  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.press('ControlOrMeta+a')

  // Comment on the selection via the format toolbar.
  await page.getByTestId('format-comment').click()
  await expect(page.getByTestId('format-comment-popover')).toBeVisible()
  await page.getByTestId('format-comment-input').fill('Check this term')
  await page.getByTestId('format-comment-apply').click()

  // The range is highlighted with a comment anchor.
  await expect(t1.locator('[data-anchor-id]')).toHaveCount(1)

  // Open the segment's comments: the thread shows the quote and body.
  await page.getByTestId('comments-toggle-1').click()
  const thread = page.locator('[data-testid^="comment-thread-"]').first()
  await expect(thread).toBeVisible()
  await expect(thread).toContainText('Check this term')
  await expect(thread).toContainText('Hola mundo') // the anchored quote

  // Reply to the thread.
  await thread.locator('[data-testid^="comment-reply-toggle-"]').click()
  const replyInput = thread.locator('[data-testid^="comment-reply-input-"]')
  await replyInput.fill('Agreed')
  await replyInput.press('ControlOrMeta+Enter')
  await expect(
    thread.locator('[data-testid^="comment-reply-"]').filter({ hasText: 'Agreed' }),
  ).toBeVisible()

  // Resolving the thread drops the highlight but keeps the comment.
  await thread.locator('[data-testid^="comment-resolve-"]').click()
  await expect(thread).toHaveAttribute('data-resolved', 'true')
  await expect(t1.locator('[data-anchor-id]')).toHaveCount(0)
})

test('anchored comment appears in the project-wide Comments panel', async ({ page }) => {
  await importSample(page)

  await setTarget(page, 1, 'Hola mundo')
  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.press('ControlOrMeta+a')
  await page.getByTestId('format-comment').click()
  await page.getByTestId('format-comment-input').fill('Panel note')
  await page.getByTestId('format-comment-apply').click()
  await expect(t1.locator('[data-anchor-id]')).toHaveCount(1)

  // The Comments panel (Revise stage) lists the thread; jump works.
  await page.getByTestId('stage-revise').click()
  await expect(page.getByTestId('comments-results')).toBeVisible()
  await expect(page.getByTestId('comments-results')).toContainText('Panel note')
})
