import pg from 'pg'
import type { Actor } from './types'

pg.types.setTypeParser(20, (v) => Number(v)) // int8 ids → number (all ids < 2^53); numeric stays string (money precision)

/** What repositories receive: run one parameterised statement, get rows back. */
export interface Queryable { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> }
/** Minimal actor shape needed to stamp the DB session (audit / RLS). */
export type SessionActor = Pick<Actor, 'id' | 'userType'> | { id: null; userType: 'SYSTEM' }

export interface Db {
  /** One transaction; purchasing.user_id / purchasing.user_type are set LOCAL so pooled connections never leak context. */
  session<T>(actor: SessionActor, fn: (q: Queryable) => Promise<T>, extra?: Record<string, string>): Promise<T>
  close(): Promise<void>
}

// Workers forbid sharing sockets across requests → one client per request there; Node/Vercel reuse a module pool.
const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
const pools = new Map<string, pg.Pool>()
const sharedPool = (url: string) => {
  let p = pools.get(url)
  if (!p) {
    p = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 })
    // Neon autosuspend / restarts kill idle connections; without this listener the whole process crashes.
    p.on('error', (e) => console.error(JSON.stringify({ msg: 'pg idle client error', code: (e as any).code })))
    pools.set(url, p)
  }
  return p
}

export function createDb(connectionString: string): Db {
  const pool = isWorkers ? new pg.Pool({ connectionString, max: 1 }) : sharedPool(connectionString)
  return {
    async session(actor, fn, extra = {}) {
      const client = await pool.connect()
      const q: Queryable = { query: async (sql, params = []) => (await client.query(sql, params as any[])).rows }
      try {
        await client.query('BEGIN')
        const ctx: Record<string, string> = { 'purchasing.user_id': actor.id == null ? '' : String(actor.id), 'purchasing.user_type': actor.userType, ...extra }
        const keys = Object.keys(ctx)
        await client.query(`SELECT ${keys.map((_, i) => `set_config($${i * 2 + 1}, $${i * 2 + 2}, true)`).join(', ')}`, keys.flatMap((k) => [k, ctx[k]]))
        const out = await fn(q)
        await client.query('COMMIT')
        return out
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    },
    close: async () => { if (isWorkers) await pool.end() },
  }
}
