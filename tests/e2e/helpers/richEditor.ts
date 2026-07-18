import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Helpers for driving the target editor in e2e tests.
 *
 * Since revamp Phase 1.2 the rich (Lexical) editor is the default, so a segment
 * target is a `contenteditable` <div>, not a <textarea>. Playwright's `.fill()`
 * and `toHaveValue()` only work on form controls, so tests type with the
 * keyboard and assert with `toHaveText()`. Code segments and the opt-out still
 * render a textarea, but no e2e fixture uses those paths.
 */

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

/** The target editor locator for segment `index` (rich contenteditable). */
export function targetEditor(page: Page, index: number): Locator {
  return page.getByTestId(`target-${index}`)
}

/** Replace a rich target's content with `text`, leaving the caret at the end. */
export async function setTarget(page: Page, index: number, text: string): Promise<void> {
  const editor = targetEditor(page, index)
  await editor.click()
  await clearTarget(page, editor)
  await editor.pressSequentially(text)
  await expect(editor).toHaveText(text)
}

/** Clear a focused rich target (select-all + delete). */
export async function clearTarget(page: Page, editor: Locator): Promise<void> {
  await editor.click()
  await page.keyboard.press(`${MOD}+a`)
  await page.keyboard.press('Delete')
}

/** Assert a rich target's visible text (string is exact after trim; RegExp matches). */
export async function expectTargetText(
  page: Page,
  index: number,
  expected: string | RegExp,
  options?: { timeout?: number },
): Promise<void> {
  await expect(targetEditor(page, index)).toHaveText(expected, options)
}
