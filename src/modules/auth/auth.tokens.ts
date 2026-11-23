import { SignJWT, jwtVerify } from 'jose'

export const ACCESS_TTL_S = 15 * 60
export const REFRESH_TTL_S = 7 * 24 * 3600
export const SESSION_MAX_S = 12 * 3600 * 2 // absolute session lifetime: 24h

const key = (s: string) => new TextEncoder().encode(s)

export const signAccessToken = (secret: string, p: { sub: string; sid: number }) =>
  new SignJWT({ sid: p.sid }).setProtectedHeader({ alg: 'HS256' }).setSubject(p.sub).setIssuedAt().setExpirationTime(`${ACCESS_TTL_S}s`).sign(key(secret))

export async function verifyAccessToken(secret: string, token: string) {
  const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] })
  return { sub: String(payload.sub), sid: Number(payload.sid) }
}

export const newRefreshToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}
/** hex SHA-256; stored with decode($n,'hex') so the raw token never touches the DB. */
export async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('')
}
