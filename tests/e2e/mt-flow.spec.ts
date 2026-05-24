import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MD_FIXTURE = path.resolve(HERE, 'fixtures/sample.md')

const LIBRE_ENDPOINT = 'https://lt.example.test/translate'

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
  await page.getByTestId('mt-mymemory-enabled').uncheck()

  await importSample(page, 'mt-project')

  // Switch to the MT tab — should show empty state.
  await page.getByTestId('sidebar-tab-mt').click()
  await expect(page.getByTestId('mt-empty')).toBeVisible()

  // Configure LibreTranslate in Settings.
  await page.goto('/#/settings')
  await page.getByTestId('mt-libretranslate-enabled').check()
  await page.getByTestId('mt-libre-endpoint').fill(LIBRE_ENDPOINT)
  await page.getByTestId('mt-libretranslate-default').check()

  // Go back to project list, open project, switch to MT.
  await page.goto('/')
  await page.getByText('mt-project').click()
  await expect(page).toHaveURL(/#\/project\//)
  await page.getByTestId('sidebar-tab-mt').click()

  // Focus first segment, click Translate.
  const firstTarget = page.getByTestId('target-1')
  await firstTarget.click()

  await page.getByTestId('mt-translate-button').click()
  const result = page.getByTestId('mt-result')
  await expect(result).toBeVisible()
  await expect(result).toContainText('Frase traducida por LT.')

  // Apply.
  await page.getByTestId('mt-apply').click()
  await expect(firstTarget).toHaveValue('Frase traducida por LT.')

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
