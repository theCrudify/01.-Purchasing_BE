import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../env'
import { HttpError } from '../core/errors'
import { clientIp } from '../core/client-ip'

// shortcut: per-isolate in-memory counter, so the limit is approximate across Workers isolates;
// upgrade to Cloudflare Rate Limiting binding / KV when abuse is observed.
const hits = new Map<string, { n: number; reset: number }>()

export const rateLimit = (name: string, limit: number, windowMs: number) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const ip = clientIp(c) ?? 'local'
    const key = `${name}:${ip}`
    const now = Date.now()
    let h = hits.get(key)
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h) }
    if (++h.n > limit) {
      c.header('retry-after', String(Math.ceil((h.reset - now) / 1000)))
      throw new HttpError(429, 'RATE_LIMITED', 'Too many requests')
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    await next()
  })
