import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../env'
import { unauthorized, forbidden } from '../core/errors'
import { verifyAccessToken } from '../modules/auth/auth.tokens'
import { AuthRepository } from '../modules/auth/auth.repository'

export const ACCESS_COOKIE = 'kpin_at'

/** Valid JWT + live session + ACTIVE user → c.var.actor (permissions loaded fresh, so revocation is immediate). */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, ACCESS_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer /i, '')
  if (!token) throw unauthorized()
  const claims = await verifyAccessToken(c.get('cfg').JWT_SECRET, token).catch(() => null)
  if (!claims) throw unauthorized('Invalid or expired token')
  const actor = await c.get('db').session({ id: null, userType: 'SYSTEM' }, (q) => new AuthRepository(q).loadActor(claims.sid))
  if (!actor) throw unauthorized('Session ended')
  c.set('actor', actor)
  await next()
})

export const requirePermission = (...codes: string[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const a = c.get('actor')
    if (!codes.some((x) => a.permissions.has(x))) throw forbidden(`Requires ${codes.join(' or ')}`)
    await next()
  })

export const requireUserType = (...types: Array<'INTERNAL' | 'BP'>) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!(types as string[]).includes(c.get('actor').userType)) throw forbidden()
    await next()
  })
