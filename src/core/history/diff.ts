/**
 * A small word-level diff for target text, used by the version-history UI to
 * show what changed between two segment states. Pure and dependency-free so it
 * is testable headlessly and adds no bundle weight; the same util will back
 * tracked changes later.
 *
 * The algorithm is a classic longest-common-subsequence over whitespace-split
 * tokens, emitting a run-length-merged sequence of equal / removed / added ops.
 */

export type DiffOp = 'equal' | 'remove' | 'add'

export interface DiffPart {
  op: DiffOp
  text: string
}

/** Split into words while keeping the trailing whitespace attached to each. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? []
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)
  const n = a.length
  const m = b.length

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const raw: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ op: 'equal', text: a[i] })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ op: 'remove', text: a[i] })
      i += 1
    } else {
      raw.push({ op: 'add', text: b[j] })
      j += 1
    }
  }
  while (i < n) {
    raw.push({ op: 'remove', text: a[i] })
    i += 1
  }
  while (j < m) {
    raw.push({ op: 'add', text: b[j] })
    j += 1
  }

  // Merge adjacent same-op runs into single parts.
  const merged: DiffPart[] = []
  for (const part of raw) {
    const last = merged[merged.length - 1]
    if (last && last.op === part.op) last.text += part.text
    else merged.push({ ...part })
  }
  return merged
}
