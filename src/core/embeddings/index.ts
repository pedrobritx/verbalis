type FeaturePipeline = (
  text: string | string[],
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>

let pipelinePromise: Promise<FeaturePipeline> | null = null
let pipelineModel: string | null = null

export async function getPipeline(model: string): Promise<FeaturePipeline> {
  if (pipelinePromise && pipelineModel === model) return pipelinePromise
  pipelineModel = model
  pipelinePromise = (async () => {
    const mod = (await import('@xenova/transformers')) as unknown as {
      pipeline: (task: string, model: string, opts: { quantized?: boolean }) => Promise<FeaturePipeline>
      env: { allowLocalModels: boolean }
    }
    mod.env.allowLocalModels = false
    return mod.pipeline('feature-extraction', model, { quantized: true })
  })()
  return pipelinePromise
}

export async function embed(text: string, model: string): Promise<Float32Array> {
  const pipe = await getPipeline(model)
  const out = await pipe(text, { pooling: 'mean', normalize: true })
  return new Float32Array(out.data as ArrayLike<number>)
}

export async function embedMany(
  texts: string[],
  model: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Float32Array[]> {
  const results: Float32Array[] = []
  for (let i = 0; i < texts.length; i += 1) {
    results.push(await embed(texts[i], model))
    onProgress?.(i + 1, texts.length)
  }
  return results
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i += 1) s += a[i] * b[i]
  return s
}
