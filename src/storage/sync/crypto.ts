/**
 * End-to-end encryption codec for the LAN sync transport (Foundation F3).
 *
 * Peers exchange Yjs updates over the network; F3's decided architecture calls
 * for that channel to be authenticated and end-to-end encrypted. This module is
 * the on-device crypto primitive: an AES-GCM payload codec keyed by a shared
 * project passphrase (PBKDF2-derived). It is transport-agnostic — the
 * same-machine BroadcastChannel transport uses the identity codec (encryption is
 * moot within one OS user session), while the Tauri/LAN transport wraps every
 * payload with {@link encrypt} so nothing readable crosses the wire.
 *
 * Everything runs through the platform WebCrypto (`crypto.subtle`); no key
 * material ever leaves the device, consistent with the local-first promise.
 */

/** A reversible transform applied to every transport payload before/after I/O. */
export interface PayloadCodec {
  encode(plain: Uint8Array): Promise<Uint8Array>
  decode(wire: Uint8Array): Promise<Uint8Array>
}

/** No-op codec: payloads pass through unchanged (same-machine transports). */
export const identityCodec: PayloadCodec = {
  encode: async (plain) => plain,
  decode: async (wire) => wire,
}

const PBKDF2_ITERATIONS = 150_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BITS = 256

const enc = new TextEncoder()

/**
 * Coerce a `Uint8Array` to `BufferSource`. TypeScript 5.9's DOM lib types
 * `Uint8Array` as generic over its backing buffer (`ArrayBufferLike`), but
 * WebCrypto only accepts `ArrayBuffer`-backed views; our arrays always are, so
 * this narrows the type without copying.
 */
const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource

/**
 * Derive an AES-GCM key from a shared passphrase. The salt must be agreed
 * between peers (it travels in the clear alongside the ciphertext); secrecy
 * rests on the passphrase, not the salt.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    buf(enc.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a payload with AES-GCM. The output is `iv (12) || ciphertext+tag`,
 * self-describing so {@link decrypt} needs only the key.
 */
export async function encrypt(key: CryptoKey, plain: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(plain)),
  )
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv, 0)
  out.set(cipher, iv.length)
  return out
}

/** Decrypt a payload produced by {@link encrypt}. Throws on tamper/wrong key. */
export async function decrypt(key: CryptoKey, wire: Uint8Array): Promise<Uint8Array> {
  const iv = wire.subarray(0, IV_BYTES)
  const cipher = wire.subarray(IV_BYTES)
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(cipher)),
  )
}

/** A fresh random salt for first-time key derivation in a shared project. */
export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES))
}

/**
 * A deterministic salt derived from a seed (the project id), so peers sharing a
 * passphrase derive the same key with no handshake. The salt is not secret;
 * secrecy rests on the passphrase.
 */
export async function deterministicSalt(seed: string): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buf(enc.encode(seed))))
  return digest.subarray(0, SALT_BYTES)
}

/**
 * Build an AES-GCM codec from a shared passphrase, keyed by a seed (the project
 * id) so all peers of one shared project converge on the same key.
 */
export async function codecForPassphrase(
  passphrase: string,
  seed: string,
): Promise<PayloadCodec> {
  const salt = await deterministicSalt(seed)
  const key = await deriveKey(passphrase, salt)
  return createAesCodec(key, salt)
}

/**
 * Build an AES-GCM codec for a project share passphrase. The salt is prepended
 * to every encoded frame so a joining peer can derive the same key without a
 * separate handshake.
 */
export function createAesCodec(key: CryptoKey, salt: Uint8Array): PayloadCodec {
  return {
    encode: async (plain) => {
      const body = await encrypt(key, plain)
      const out = new Uint8Array(salt.length + body.length)
      out.set(salt, 0)
      out.set(body, salt.length)
      return out
    },
    decode: async (wire) => decrypt(key, wire.subarray(SALT_BYTES)),
  }
}
