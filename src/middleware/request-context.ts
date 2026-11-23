import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../env'
import { readConfig } from '../env'
import { createDb } from '../core/db'

/** config + request id + a per-request Db handle (closed after the response on Workers). */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const cfg = readConfig(c.env)
  c.set('cfg', cfg)
  const id = c.req.header('x-request-id')?.slice(0, 64) || crypto.randomUUID()
  c.set('requestId', id)
  c.header('x-request-id', id)
  const db = createDb(cfg.DATABASE_URL)
  c.set('db', db)
  try { await next() } finally {
    const done = db.close().catch(() => {})
    try { c.executionCtx.waitUntil(done) } catch { /* no executionCtx on Node/Vercel */ }
  }
})
