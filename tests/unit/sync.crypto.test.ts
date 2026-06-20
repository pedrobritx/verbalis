import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  codecForPassphrase,
  createAesCodec,
  decrypt,
  deriveKey,
  encrypt,
  identityCodec,
  newSalt,
} from '@/storage/sync/crypto'

// jsdom doesn't expose WebCrypto's subtle; use Node's implementation.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

const bytes = (s: string) => new TextEncoder().encode(s)
const str = (b: Uint8Array) => new TextDecoder().decode(b)

describe('sync crypto (F3)', () => {
  it('identity codec passes payloads through unchanged', async () => {
    const data = bytes('hello')
    expect(str(await identityCodec.encode(data))).toBe('hello')
    expect(str(await identityCodec.decode(data))).toBe('hello')
  })

  it('AES-GCM round-trips a payload', async () => {
    const key = await deriveKey('correct horse', newSalt())
    const cipher = await encrypt(key, bytes('secret segment'))
    expect(str(cipher)).not.toContain('secret')
    expect(str(await decrypt(key, cipher))).toBe('secret segment')
  })

  it('a wrong passphrase fails to decrypt', async () => {
    const salt = newSalt()
    const good = await deriveKey('right', salt)
    const bad = await deriveKey('wrong', salt)
    const cipher = await encrypt(good, bytes('data'))
    await expect(decrypt(bad, cipher)).rejects.toBeTruthy()
  })

  it('codecForPassphrase converges across peers from the same project + passphrase', async () => {
    const a = await codecForPassphrase('shared-secret', 'project-123')
    const b = await codecForPassphrase('shared-secret', 'project-123')
    const wire = await a.encode(bytes('peer message'))
    expect(str(await b.decode(wire))).toBe('peer message')
  })

  it('createAesCodec frames carry the salt and decode back', async () => {
    const salt = newSalt()
    const key = await deriveKey('pw', salt)
    const codec = createAesCodec(key, salt)
    const wire = await codec.encode(bytes('framed'))
    expect(str(await codec.decode(wire))).toBe('framed')
  })
})
