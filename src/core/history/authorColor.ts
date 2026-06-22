// Deterministic per-author colour for tracked-changes attribution. Authors are
// open-ended (any display name), so we hash the name into a hue rather than keep
// a fixed token palette — a data-visualization colour, distinct from the chrome
// tokens in tokens.css. 55% lightness reads on both the light and dark themes.

export function colorForAuthor(name: string | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return 'var(--color-muted)'
  let hash = 0
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 65% 55%)`
}
