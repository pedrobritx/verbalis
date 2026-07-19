import type { InlineRun } from './model'

/**
 * Extract formatted inline runs from a segment's `targetRich` (serialized Lexical
 * state) for DOCX export — pure JSON walking, no editor. Formatting maps from
 * Lexical text-format flags; tracked changes export as their accepted preview
 * (D2): pending insertions are kept as normal text, pending deletions are
 * dropped. Comment anchors pass through; inline tags render their placeholder.
 */

// Lexical text-format bit flags.
const IS_BOLD = 1
const IS_ITALIC = 2
const IS_UNDERLINE = 8
const IS_SUBSCRIPT = 32
const IS_SUPERSCRIPT = 64

interface RichNode {
  type?: string
  text?: string
  format?: number
  tagId?: string
  changeType?: 'insert' | 'delete'
  url?: string
  children?: RichNode[]
}

interface Ctx {
  href?: string
  drop: boolean
}

function fmt(format: number | undefined): Partial<InlineRun> {
  const f = format ?? 0
  const out: Partial<InlineRun> = {}
  if (f & IS_BOLD) out.bold = true
  if (f & IS_ITALIC) out.italic = true
  if (f & IS_UNDERLINE) out.underline = true
  if (f & IS_SUBSCRIPT) out.sub = true
  if (f & IS_SUPERSCRIPT) out.sup = true
  return out
}

function sameFmt(a: InlineRun, b: InlineRun): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.sub === !!b.sub &&
    !!a.sup === !!b.sup &&
    a.href === b.href
  )
}

function push(runs: InlineRun[], run: InlineRun): void {
  if (!run.text) return
  const last = runs[runs.length - 1]
  if (last && sameFmt(last, run)) {
    last.text += run.text
    return
  }
  runs.push(run)
}

function walk(node: RichNode, ctx: Ctx, runs: InlineRun[]): void {
  const type = node.type
  if (type === 'text') {
    if (ctx.drop) return
    push(runs, { text: node.text ?? '', ...fmt(node.format), ...(ctx.href ? { href: ctx.href } : {}) })
    return
  }
  if (type === 'linebreak') {
    if (!ctx.drop) push(runs, { text: '\n', ...(ctx.href ? { href: ctx.href } : {}) })
    return
  }
  if (type === 'inline-tag') {
    if (!ctx.drop) push(runs, { text: `{${node.tagId ?? ''}}` })
    return
  }
  const childCtx: Ctx = { ...ctx }
  if (type === 'change-mark' && node.changeType === 'delete') childCtx.drop = true
  if (type === 'link' && typeof node.url === 'string') childCtx.href = node.url
  if (node.children) for (const child of node.children) walk(child, childCtx, runs)
}

/** Formatted runs for a `targetRich` state (empty array for missing/invalid input). */
export function targetRichToRuns(targetRich: string | undefined): InlineRun[] {
  if (!targetRich) return []
  let root: RichNode | undefined
  try {
    root = (JSON.parse(targetRich) as { root?: RichNode }).root
  } catch {
    return []
  }
  if (!root) return []
  const runs: InlineRun[] = []
  walk(root, { drop: false }, runs)
  return runs
}
