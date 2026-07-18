import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { targetEditor, setTarget, expectTargetText } from './helpers/richEditor'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

test('save a named version and restore the project to it', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Import file' }).click()
  await page.setInputFiles('#import-file', FIXTURE)
  await expect(page.locator('#import-name')).toHaveValue('sample')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/#\/project\//)

  const list = page.getByTestId('segment-list')
  await expect(list).toBeVisible()

  // Translate and confirm a segment, then save a named version of that state.
  const target1 = targetEditor(page, 1)
  await setTarget(page, 1, 'First translation.')
  const row1Pill = list.locator('[data-segment-row]').nth(1).getByTestId('status-pill')
  await expect(row1Pill).toHaveAttribute('data-status', 'draft', { timeout: 2000 })
  await target1.press('Control+Enter')
  await expect(row1Pill).toHaveAttribute('data-status', 'translated')

  // History lives in the Revise stage's stacked sidebar sections.
  await page.getByTestId('stage-revise').click()
  await expect(page.getByTestId('history-panel')).toBeVisible()
  await page.getByTestId('version-label-input').fill('milestone')
  await page.getByTestId('save-version').click()

  const milestone = page.getByTestId('version-item').filter({ hasText: 'milestone' })
  await expect(milestone).toHaveCount(1)

  // Change the translation after the version was saved; let autosave flush.
  await setTarget(page, 1, 'Second translation.')
  await page.waitForTimeout(500)
  await expectTargetText(page, 1, 'Second translation.')

  // Restore the project to the saved version.
  await milestone.getByTestId('version-restore').click()
  await milestone.getByTestId('version-restore-confirm').click()

  await expectTargetText(page, 1, 'First translation.')
})
