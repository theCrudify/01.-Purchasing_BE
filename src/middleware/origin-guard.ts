import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../env'
import { HttpError } from '../core/errors'

/** CSRF defence for cookie auth: mutating requests must come from an allow-listed Origin (SameSite=Lax is the 2nd layer). */
export const originGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const allowed = c.get('cfg').ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    const origin = c.req.header('origin')
    if (!origin || !allowed.includes(origin)) throw new HttpError(403, 'BAD_ORIGIN', 'Origin not allowed')
  }
  await next()
})
