import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

/**
 * F3 LAN collaboration, exercised at the browser level via the same-machine
 * BroadcastChannel transport: two tabs (same context → shared origin) open one
 * shared project, discover each other as peers, and see each other's edits live.
 * Presence specifically proves our sync path — Dexie alone does not exchange it.
 */
test('two peers discover each other and sync edits over the LAN transport', async ({
  context,
}) => {
  const page1 = await context.newPage()
  await page1.goto('/')

  await page1.getByRole('button', { name: 'Import file' }).click()
  await page1.setInputFiles('#import-file', FIXTURE)
  await expect(page1.locator('#import-name')).toHaveValue('sample')
  await page1.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page1).toHaveURL(/#\/project\//)
  await expect(page1.getByTestId('segment-list')).toBeVisible()
  const projectUrl = page1.url()

  // Second tab opens the same project.
  const page2 = await context.newPage()
  await page2.goto(projectUrl)
  await expect(page2.getByTestId('segment-list')).toBeVisible()

  // Enable sharing from the first tab; the flag is per-project, so the second
  // tab picks it up and both start a sync session.
  await page1.getByTestId('sidebar-tab-peers').click()
  await expect(page1.getByTestId('peers-panel')).toBeVisible()
  await page1.getByTestId('peers-share-toggle').check()

  await page2.getByTestId('sidebar-tab-peers').click()
  await expect(page2.getByTestId('peers-panel')).toBeVisible()
  await expect(page2.getByTestId('peers-share-toggle')).toBeChecked()

  // Each tab sees the other as a peer (presence travels over our transport).
  await expect(page1.getByTestId('peers-list').locator('li')).toHaveCount(1, { timeout: 10_000 })
  await expect(page2.getByTestId('peers-list').locator('li')).toHaveCount(1, { timeout: 10_000 })

  // A live edit on tab 1 converges on tab 2.
  const target1 = page1.getByTestId('target-1')
  await target1.click()
  await target1.fill('Synced across peers.')
  await expect(page2.getByTestId('target-1')).toHaveValue('Synced across peers.', {
    timeout: 10_000,
  })
})
