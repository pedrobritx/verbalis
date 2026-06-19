import type { CorpusManifest, CorpusPackFile } from './types'

// Static corpora assets live under <base>/corpora/. BASE_URL is '/verbalis/' in
// production and '/' under test/dev, so this resolves correctly in both.
export function corpusAssetUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/$/, '')}/corpora/${file}`
}

export async function fetchCorpusManifest(signal?: AbortSignal): Promise<CorpusManifest> {
  const res = await fetch(corpusAssetUrl('manifest.json'), { signal })
  if (!res.ok) throw new Error(`Failed to load corpora manifest (${res.status})`)
  return (await res.json()) as CorpusManifest
}

export async function fetchCorpusPack(
  file: string,
  signal?: AbortSignal,
): Promise<CorpusPackFile> {
  const res = await fetch(corpusAssetUrl(file), { signal })
  if (!res.ok) throw new Error(`Failed to load corpus pack ${file} (${res.status})`)
  return (await res.json()) as CorpusPackFile
}
