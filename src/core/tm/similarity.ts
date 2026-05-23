export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Ensure a is the shorter string to minimize memory.
  if (a.length > b.length) {
    const tmp = a
    a = b
    b = tmp
  }

  const m = a.length
  const n = b.length
  let prev = new Array<number>(m + 1)
  let curr = new Array<number>(m + 1)

  for (let i = 0; i <= m; i++) prev[i] = i

  for (let j = 1; j <= n; j++) {
    curr[0] = j
    const bj = b.charCodeAt(j - 1)
    for (let i = 1; i <= m; i++) {
      const cost = a.charCodeAt(i - 1) === bj ? 0 : 1
      const del = prev[i] + 1
      const ins = curr[i - 1] + 1
      const sub = prev[i - 1] + cost
      curr[i] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub
    }
    const swap = prev
    prev = curr
    curr = swap
  }

  return prev[m]
}

export function similarityRatio(a: string, b: string): number {
  if (a === '' && b === '') return 1
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}
