import bcrypt from 'bcryptjs'

// PBKDF2-SHA256 via WebCrypto: native code, so it fits the Workers Free 10 ms CPU budget where pure-JS bcryptjs (60-140 ms) did not.
// shortcut: 20k iterations (~4 ms) is sized for Workers Free; raise ITER on Workers Paid (OWASP: 600k) — old hashes are re-hashed on next login.
export const ITER = 20_000
const MAX_ITER = 1_000_000
const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (s: string) => new Uint8Array(s.match(/../g)?.map((h) => parseInt(h, 16)) ?? [])

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITER}$${hex(salt.buffer)}$${hex(await derive(password, salt, ITER))}`
}

/** Accepts pbkdf2 hashes and legacy bcrypt ones (verified once, then re-hashed by the login via needsRehash). */
export async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith('$2')) return bcrypt.compare(password, stored)
  const [scheme, iter, salt, hash] = stored.split('$')
  const iterations = Number(iter)
  if (scheme !== 'pbkdf2' || !salt || !hash || !Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITER) return false
  const a = new Uint8Array(await derive(password, unhex(salt), iterations)), b = unhex(hash)
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ (b[i] ?? 0) // constant-time compare
  return diff === 0
}

export const needsRehash = (stored: string) => !stored.startsWith(`pbkdf2$${ITER}$`)
