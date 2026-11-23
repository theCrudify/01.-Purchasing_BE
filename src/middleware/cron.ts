import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../env'
import { unauthorized } from '../core/errors'

/** Scheduler endpoints: `x-cron-secret` (or Vercel Cron's `Authorization: Bearer`) must equal CRON_SECRET; constant-time compare. */
export const requireCronSecret = createMiddleware<AppEnv>(async (c, next) => {
  const want = c.get('cfg').CRON_SECRET
  const got = c.req.header('x-cron-secret') ?? c.req.header('authorization')?.replace(/^Bearer /i, '') ?? ''
  if (!want || want.length < 16 || !timingSafeEqual(got, want)) throw unauthorized()
  await next()
})

function timingSafeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}
