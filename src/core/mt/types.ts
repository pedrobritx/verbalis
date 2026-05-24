import type {
  MTProviderId,
  OllamaSettings,
  ClaudeSettings,
  LibreTranslateSettings,
} from '@/core/types'

export interface TranslateInput {
  text: string
  sourceLang: string
  targetLang: string
  signal?: AbortSignal
}

export interface TranslateResult {
  text: string
  providerId: MTProviderId
  model?: string
}

export type MTErrorCode =
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'invalid'
  | 'unsupported_lang'
  | 'parse'
  | 'offline'
  | 'aborted'

export class MTError extends Error {
  code: MTErrorCode
  providerId: MTProviderId
  constructor(providerId: MTProviderId, code: MTErrorCode, message: string) {
    super(message)
    this.code = code
    this.providerId = providerId
    this.name = 'MTError'
  }
}

export type ProviderSettings = OllamaSettings | ClaudeSettings | LibreTranslateSettings

export interface MTProvider<S extends ProviderSettings = ProviderSettings> {
  id: MTProviderId
  label: string
  requiresNetwork: boolean
  translate(input: TranslateInput, settings: S, fetchImpl?: typeof fetch): Promise<TranslateResult>
  testConnection?(settings: S, fetchImpl?: typeof fetch): Promise<void>
}
