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

/** Read the persisted (proposed) plain target of the segment at `index`. */
async function readSegTarget(page: import('@playwright/test').Page, index: number) {
  return page.evaluate(async (idx) => {
    const open = indexedDB.open('verbalis')
    const db = await new Promise<IDBDatabase>((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const all = await new Promise<Array<{ index: number; target: string }>>((res, rej) => {
      const r = db.transaction('segments').objectStore('segments').getAll()
      r.onsuccess = () => res(r.result as Array<{ index: number; target: string }>)
      r.onerror = () => rej(r.error)
    })
    db.close()
    return all.find((s) => s.index === idx)?.target ?? null
  }, index)
}

test('suggesting mode: typing becomes a tracked insertion; proposed target reflects it', async ({
  page,
}) => {
  await importSample(page)

  // Toggle suggesting mode, then type into the (empty) first target.
  await page.getByTestId('edit-mode-suggesting').click()
  await expect(page.getByTestId('edit-mode-suggesting')).toHaveAttribute('aria-checked', 'true')

  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.pressSequentially('Hola')

  // The typed text is wrapped in an insert mark, not plain text.
  const insertion = t1.locator('[data-change-type="insert"]')
  await expect(insertion).toHaveText('Hola')

  // The derived plain target (what TM/QA see) includes the insertion.
  await expect.poll(() => readSegTarget(page, 1)).toBe('Hola')
})

test('suggesting mode: deletion is tracked and never destroys prior text', async ({ page }) => {
  await importSample(page)

  // Write text directly first (direct mode is the default).
  await setTarget(page, 1, 'Casa')
  await expect.poll(() => readSegTarget(page, 1)).toBe('Casa')

  // Switch to suggesting, select the text and press Backspace.
  await page.getByTestId('edit-mode-suggesting').click()
  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.press('ControlOrMeta+a')
  await t1.press('Backspace')

  // The text is struck through, not removed: the DOM still shows "Casa" wrapped
  // in a delete mark (nothing prior is destroyed).
  const deletion = t1.locator('[data-change-type="delete"]')
  await expect(deletion).toHaveText('Casa')
  await expect(t1).toHaveText('Casa')

  // The proposed target drops the pending deletion.
  await expect.poll(() => readSegTarget(page, 1)).toBe('')
})

test('accept an insertion in the editor via the hover card', async ({ page }) => {
  await importSample(page)
  await page.getByTestId('edit-mode-suggesting').click()

  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.pressSequentially('Hola')
  await expect(t1.locator('[data-change-type="insert"]')).toHaveText('Hola')
  // Wait for the suggestion to persist before resolving (the resolver reads the
  // stored targetRich).
  await expect.poll(() => readSegTarget(page, 1)).toBe('Hola')

  // Click the mark to open the hover card, then accept.
  await t1.locator('[data-change-type="insert"]').click()
  await expect(page.getByTestId('change-hover-card')).toBeVisible()
  await page.getByTestId('change-hover-accept').click()

  // The mark is gone; the text stays as an accepted, normal insertion.
  await expect(t1.locator('[data-change-type="insert"]')).toHaveCount(0)
  await expect.poll(() => readSegTarget(page, 1)).toBe('Hola')
})

test('accept a suggestion from the Changes panel', async ({ page }) => {
  await importSample(page)
  await page.getByTestId('edit-mode-suggesting').click()

  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.pressSequentially('Hola')
  await expect.poll(() => readSegTarget(page, 1)).toBe('Hola')

  // The Changes panel (Suggestions tab) lists the pending change in the Revise stage.
  await page.getByTestId('stage-revise').click()
  await expect(page.getByTestId('suggestions-results')).toBeVisible()
  await page.locator('[data-testid^="suggestion-accept-"]').first().click()

  // Nothing left pending; the accepted text is the segment target.
  await expect(page.getByTestId('suggestions-empty')).toBeVisible()
  await expect.poll(() => readSegTarget(page, 1)).toBe('Hola')
})

test('reject a suggestion from the Changes panel removes the proposed insertion', async ({
  page,
}) => {
  await importSample(page)
  await page.getByTestId('edit-mode-suggesting').click()

  const t1 = targetEditor(page, 1)
  await t1.click()
  await t1.pressSequentially('Hola')
  await expect.poll(() => readSegTarget(page, 1)).toBe('Hola')

  await page.getByTestId('stage-revise').click()
  await expect(page.getByTestId('suggestions-results')).toBeVisible()
  await page.locator('[data-testid^="suggestion-reject-"]').first().click()

  // Rejecting the insertion drops the proposed text entirely.
  await expect(page.getByTestId('suggestions-empty')).toBeVisible()
  await expect.poll(() => readSegTarget(page, 1)).toBe('')
})
