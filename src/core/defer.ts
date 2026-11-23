import type { Context } from 'hono'
import type { AppEnv } from '../env'

/** Run work after the response (Workers waitUntil; on Node the promise just keeps running). Errors are logged, never thrown. */
export type Defer = (p: Promise<unknown>) => void
export const deferOf = (c: Context<AppEnv>): Defer => (p) => {
  const safe = p.catch((e) => console.error(JSON.stringify({ requestId: c.get('requestId'), msg: 'deferred', err: (e as Error).message })))
  try { c.executionCtx.waitUntil(safe) } catch { /* Node: promise keeps running */ }
}
