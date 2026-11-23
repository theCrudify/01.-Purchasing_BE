import { describe, expect, it } from 'vitest'
import { app } from '../src/index'

const env = { DATABASE_URL: 'postgresql://x:y@localhost/z', JWT_SECRET: 'x'.repeat(32), ALLOWED_ORIGINS: 'http://localhost:3000', COOKIE_SECURE: 'false' }
const ctx = { waitUntil() {}, passThroughOnException() {} } as any
const call = (path: string, init?: RequestInit) => app.request(path, init, env, ctx)

describe('api guards', () => {
  it('health is public and has security headers', async () => {
    const r = await call('/api/health')
    expect(r.status).toBe(200)
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('x-request-id')).toBeTruthy()
  })
  it('lists require auth', async () => { expect((await call('/api/departments')).status).toBe(401) })
  it('mutations from a foreign origin are rejected', async () => {
    const r = await call('/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })
    expect(r.status).toBe(403)
  })
  it('login validates input before touching the DB', async () => {
    const r = await call('/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{"email":"nope"}' })
    expect(r.status).toBe(422) // DB never reached
  })
})
