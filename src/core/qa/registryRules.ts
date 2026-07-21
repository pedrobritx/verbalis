import { extensionRegistry } from '@/core/extensions/registry'
import { QA_CODES, type QACode, type QARuleToggles } from './types'

/**
 * Fold the extension registry's QA-rule enablement into the per-project rule
 * toggles (ROADMAP §6.2). A rule runs only when its user toggle is on AND its
 * `qa.<code>` addon is enabled — so disabling the addon on the Add-ons page
 * removes it from QA output. Falls back to **all-on** when the manifest isn't
 * registered (e.g. a unit test that never registers built-ins), so `runQA` stays
 * pure and its existing tests are unaffected.
 */

/** The registry manifest id for a QA rule. */
export function qaExtensionId(code: QACode): string {
  return `qa.${code}`
}

/** Whether a QA rule's addon is enabled (default true when not registered). */
export function isQaRuleEnabled(code: QACode): boolean {
  const id = qaExtensionId(code)
  return !extensionRegistry.has(id) || extensionRegistry.isEnabled(id)
}

/**
 * AND the given rule toggles with the registry: any rule whose addon is disabled
 * is forced off; the rest keep their toggle value.
 */
export function effectiveQaRules(
  toggles: Partial<QARuleToggles>,
): Partial<QARuleToggles> {
  const out: Partial<QARuleToggles> = { ...toggles }
  for (const code of QA_CODES) {
    if (!isQaRuleEnabled(code)) out[code] = false
  }
  return out
}
