import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { targetEditor, expectTargetText } from './helpers/richEditor'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MD_FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

const LIBRE_ENDPOINT = 'https://lt.example.test/translate'

/**
 * Wait until the MT settings are actually persisted in IndexedDB before
 * navigating away. The settings UI updates its checkboxes optimistically and
 * writes to Dexie fire-and-forget, so a `page.goto` right after a toggle can
 * abort the in-flight write and lose the change (observed as a CI flake where
 * MyMemory still ran despite being unchecked).
 */
async function waitForMTPersisted(
  page: import('@playwright/test').Page,
  expected: {
    mymemoryEnabled?: boolean
    ltEnabled?: boolean
    ltEndpoint?: string
    def?: string
  },
) {
  await page.waitForFunction(async (exp) => {
    const open = indexedDB.open('verbalis')
    const db = await new Promise<IDBDatabase>((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const row = await new Promise<{ value?: Record<string, unknown> } | undefined>(
      (res, rej) => {
        const r = db.transaction('settings').objectStore('settings').get('mt.providers')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      },
    )
    db.close()
    const v = row?.value as
      | {
          mymemory?: { enabled?: boolean }
          libretranslate?: { enabled?: boolean; endpoint?: string }
          default?: string
        }
      | undefined
    if (!v) return false
    if (exp.mymemoryEnabled !== undefined && v.mymemory?.enabled !== exp.mymemoryEnabled)
      return false
    if (exp.ltEnabled !== undefined && v.libretranslate?.enabled !== exp.ltEnabled) return false
    if (exp.ltEndpoint !== undefined && v.libretranslate?.endpoint !== exp.ltEndpoint) return false
    if (exp.def !== undefined && v.default !== exp.def) return false
    return true
  }, expected)
}

async function importSample(page: import('@playwright/test').Page, name: string) {
  await page.goto('/')
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

test('MT tab shows empty state, then translates after LibreTranslate is enabled', async ({
  page,
}) => {
  // Intercept LibreTranslate calls with a deterministic mock.
  await page.route(LIBRE_ENDPOINT, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ translatedText: 'Frase traducida por LT.' }),
    })
  })

  // MyMemory is enabled by default — turn it off first so we can observe the
  // empty state and then exercise the LibreTranslate-only path.
  await page.goto('/#/settings')
  await page.getByTestId('settings-nav-mt').click()
  await page.getByTestId('mt-mymemory-enabled').uncheck()
  await waitForMTPersisted(page, { mymemoryEnabled: false })

  await importSample(page, 'mt-project')

  // The MT section is part of the default translate-stage sidebar layout —
  // it should show the empty state.
  await expect(page.getByTestId('mt-empty')).toBeVisible()

  // Configure LibreTranslate in Settings.
  await page.goto('/#/settings')
  await page.getByTestId('settings-nav-mt').click()
  await page.getByTestId('mt-libretranslate-enabled').check()
  await page.getByTestId('mt-libre-endpoint').fill(LIBRE_ENDPOINT)
  await page.getByTestId('mt-libretranslate-default').check()
  await waitForMTPersisted(page, {
    mymemoryEnabled: false,
    ltEnabled: true,
    ltEndpoint: LIBRE_ENDPOINT,
    def: 'libretranslate',
  })

  // Go back to project list, open project, switch to MT.
  await page.goto('/')
  await page.getByText('mt-project').click()
  await expect(page).toHaveURL(/#\/project\//)
  await expect(page.getByTestId('mt-panel')).toBeVisible()

  // Focus first segment, click Translate.
  const firstTarget = targetEditor(page, 1)
  await firstTarget.click()

  await page.getByTestId('mt-translate-button').click()
  const result = page.getByTestId('mt-result')
  await expect(result).toBeVisible()
  await expect(result).toContainText('Frase traducida por LT.')

  // Apply.
  await page.getByTestId('mt-apply').click()
  await expectTargetText(page, 1, 'Frase traducida por LT.')

  // Status pill should flip to draft (was untranslated).
  const pill = page
    .getByTestId('segment-list')
    .locator('[data-segment-row]')
    .nth(1)
    .getByTestId('status-pill')
  await expect(pill).toHaveAttribute('data-status', 'draft')
})

test('Settings shows semantic TM section with build button', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByTestId('settings-nav-semantic').click()
  await expect(page.getByTestId('semantic-enabled')).toBeVisible()
  await expect(page.getByTestId('semantic-model')).toContainText('paraphrase-multilingual')
  await expect(page.getByTestId('semantic-build')).toBeVisible()
  await expect(page.getByTestId('semantic-count')).toContainText('0 embedded')
})

test('Command palette switches sidebar to MT', async ({ page }) => {
  await importSample(page, 'mt-palette')
  await page.keyboard.press('Control+k')
  await page.getByTestId('cmd-sidebar-mt').click()
  await expect(page.getByTestId('mt-panel')).toBeVisible()
})
