/**
 * Encoding for Postgres `bytea` values over PostgREST (ROADMAP §4.1). Yjs docs
 * are binary (`Uint8Array`); PostgREST speaks JSON, so we send/receive bytea as
 * its Postgres hex text form (`\x…`). Kept isolated so the wire encoding can be
 * swapped without touching the cloud-project logic. Pure and unit-tested.
 */

/** Encode bytes as a Postgres bytea hex literal (`\xdeadbeef`) for inserts. */
export function encodeBytea(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return '\\x' + hex
}

/**
 * Decode a PostgREST bytea value to bytes. Handles the default hex form
 * (`\x…`); falls back to base64 for deployments configured with
 * `bytea_output = escape`-style base64 responses.
 */
export function decodeBytea(value: string): Uint8Array {
  if (value.startsWith('\\x')) {
    const hex = value.slice(2)
    const out = new Uint8Array(hex.length >> 1)
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16)
    }
    return out
  }
  const bin = atob(value)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
