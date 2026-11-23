import pg from 'pg'
import bcrypt from 'bcryptjs'
import { app } from '../src/index'

/** Integration tests run only when TEST_DATABASE_URL points at a migrated throwaway DB. */
export const DB_URL = process.env.TEST_DATABASE_URL
export const ORIGIN = 'http://localhost:3000'
export const env = { DATABASE_URL: DB_URL, JWT_SECRET: 'x'.repeat(32), ALLOWED_ORIGINS: ORIGIN, COOKIE_SECURE: 'false', CRON_SECRET: 'c'.repeat(32), PAYMENT_API_KEY: 'p'.repeat(32) }
const ctx = { waitUntil() {}, passThroughOnException() {} } as any

export async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: DB_URL }); await c.connect()
  try { return (await c.query(text, params as any[])).rows } finally { await c.end() }
}

/** Creates (or resets) a user with the given permissions and returns its id. */
export async function ensureUser(email: string, password: string, perms: string[] | 'ALL', userType: 'INTERNAL' | 'BP' = 'INTERNAL') {
  const role = `T_${email.replace(/\W/g, '_')}`.slice(0, 50).toUpperCase()
  const [r] = await sql(`INSERT INTO mst_role ("Code","Name","Scope") VALUES ($1,$1,$2) ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`, [role, userType])
  await sql(`DELETE FROM mst_role_permission WHERE "RoleId"=$1`, [r.Id])
  await sql(`INSERT INTO mst_permission ("Code","Module","Name") SELECT x, split_part(x,'.',1), x FROM unnest($1::text[]) x ON CONFLICT DO NOTHING`, [perms === 'ALL' ? [] : perms])
  await sql(`INSERT INTO mst_role_permission ("RoleId","PermissionId") SELECT $1,"Id" FROM mst_permission WHERE $2::boolean OR "Code" = ANY($3) ON CONFLICT DO NOTHING`, [r.Id, perms === 'ALL', perms === 'ALL' ? [] : perms])
  const [u] = await sql(`INSERT INTO mst_user ("UserType","Email","DisplayName","Status") VALUES ($2,$1,$1,'ACTIVE') ON CONFLICT ("Email") DO UPDATE SET "Status"='ACTIVE' RETURNING "Id"`, [email, userType])
  await sql(`INSERT INTO sys_user_credential ("UserId","PasswordHash") VALUES ($1,$2) ON CONFLICT ("UserId") DO UPDATE SET "PasswordHash"=EXCLUDED."PasswordHash","FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL`, [u.Id, await bcrypt.hash(password, 4)])
  await sql(`INSERT INTO mst_user_role ("UserId","RoleId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u.Id, r.Id])
  return u.Id as number
}

/** Tiny cookie-jar client around app.request. */
export function client() {
  const jar = new Map<string, string>()
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    if (!path.startsWith('/api/')) path = '/api' + path
    const res = await app.request(path, {
      method,
      headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx)
    for (const sc of res.headers.getSetCookie()) {
      const [kv] = sc.split(';'); const i = kv!.indexOf('=')
      const k = kv!.slice(0, i), v = kv!.slice(i + 1)
      if (v === '' || /max-age=0/i.test(sc)) jar.delete(k); else jar.set(k, v)
    }
    const json = await res.json().catch(() => null)
    return { status: res.status, json: json as any }
  }
  return {
    jar, call,
    get: (p: string) => call('GET', p), post: (p: string, b?: unknown) => call('POST', p, b ?? {}),
    patch: (p: string, b: unknown) => call('PATCH', p, b), del: (p: string, b?: unknown) => call('DELETE', p, b),
    login: (email: string, password: string) => call('POST', '/api/auth/login', { email, password }),
  }
}
