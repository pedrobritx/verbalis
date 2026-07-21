import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTarget, expectTargetText, targetEditor } from './helpers/richEditor'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

/**
 * F3 LAN collaboration + §4.4 live-collab UX, exercised at the browser level via
 * the same-machine BroadcastChannel transport: two tabs (same context → shared
 * origin) open one shared project, discover each other as peers, see each other's
 * edits live, and contend for per-segment edit leases. Presence specifically
 * proves our sync path — Dexie alone does not exchange it.
 */

/** Import the fixture in one tab, open it in a second, and share from both. */
async function openSharedProjectInTwoTabs(
  context: BrowserContext,
): Promise<{ page1: Page; page2: Page }> {
  const page1 = await context.newPage()
  await page1.goto('/')
  await page1.getByRole('button', { name: 'Import file' }).click()
  await page1.setInputFiles('#import-file', FIXTURE)
  await expect(page1.locator('#import-name')).toHaveValue('sample')
  await page1.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page1).toHaveURL(/#\/project\//)
  await expect(page1.getByTestId('segment-list')).toBeVisible()

  const page2 = await context.newPage()
  await page2.goto(page1.url())
  await expect(page2.getByTestId('segment-list')).toBeVisible()

  // Enable sharing from the first tab; the flag is per-project, so the second
  // tab picks it up and both start a sync session.
  await page1.getByTestId('peers-presence-chip').click()
  await expect(page1.getByTestId('peers-panel')).toBeVisible()
  await page1.getByTestId('peers-share-toggle').click()
  await expect(page1.getByTestId('peers-share-toggle')).toBeChecked()

  await page2.getByTestId('peers-presence-chip').click()
  await expect(page2.getByTestId('peers-panel')).toBeVisible()
  await expect(page2.getByTestId('peers-share-toggle')).toBeChecked()

  // Each tab sees the other as a peer (presence travels over our transport).
  await expect(page1.getByTestId('peers-list').locator('li')).toHaveCount(1, { timeout: 10_000 })
  await expect(page2.getByTestId('peers-list').locator('li')).toHaveCount(1, { timeout: 10_000 })

  return { page1, page2 }
}

test('two peers discover each other and sync edits over the LAN transport', async ({ context }) => {
  const { page1, page2 } = await openSharedProjectInTwoTabs(context)

  // A live edit on tab 1 converges on tab 2.
  await setTarget(page1, 1, 'Synced across peers.')
  await expectTargetText(page2, 1, 'Synced across peers.', { timeout: 10_000 })
})

test('simultaneous entry yields one editor + one viewer, and the lease releases on blur', async ({
  context,
}) => {
  const { page1, page2 } = await openSharedProjectInTwoTabs(context)

  // Both peers enter the same segment at once (§4.4).
  await targetEditor(page1, 1).click()
  await targetEditor(page2, 1).click()

  // The deterministic lowest-peerId tie-break demotes exactly one tab to a
  // read-only viewer, shown by the "is editing" lease chip.
  const chip1 = page1.getByTestId('lease-chip-1')
  const chip2 = page2.getByTestId('lease-chip-1')
  await expect(async () => {
    expect((await chip1.count()) + (await chip2.count())).toBe(1)
  }).toPass({ timeout: 10_000 })

  const viewer = (await chip1.count()) ? page1 : page2
  const owner = viewer === page1 ? page2 : page1

  // One editor, one viewer: the viewer's target is read-only, the owner's is not.
  await expect(targetEditor(viewer, 1)).toHaveAttribute('contenteditable', 'false')
  await expect(targetEditor(owner, 1)).toHaveAttribute('contenteditable', 'true')

  // The owner blurs the segment (moves to another) → the lease releases and the
  // former viewer becomes the editor.
  await targetEditor(owner, 0).click()
  await expect(viewer.getByTestId('lease-chip-1')).toHaveCount(0, { timeout: 10_000 })
  await expect(targetEditor(viewer, 1)).toHaveAttribute('contenteditable', 'true')
})

test("a peer's caret renders as a live remote cursor in the other tab", async ({ context }) => {
  const { page1, page2 } = await openSharedProjectInTwoTabs(context)

  // Tab 1 edits segment 1, reporting its caret through presence (§4.4.1).
  await targetEditor(page1, 1).click()
  await page1.keyboard.type('hi')

  // Tab 2, which is not on that segment, paints tab 1's remote caret + name label.
  await expect(page2.getByTestId('remote-caret').first()).toBeAttached({ timeout: 10_000 })
})
