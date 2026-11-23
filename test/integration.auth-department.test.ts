import { beforeAll, describe, expect, it } from 'vitest'
import { DB_URL, client, ensureUser, sql } from './helpers'

describe.skipIf(!DB_URL)('auth + department (real Postgres)', () => {
  beforeAll(async () => {
    await ensureUser('admin@test.local', 'Secret-pass-123', 'ALL')
    await ensureUser('viewer@test.local', 'Secret-pass-123', ['MASTER.VIEW'])
    await sql(`DELETE FROM mst_department WHERE "Code" LIKE 'T-%'`)
  })

  it('login → CRUD → search/sort/paging → soft delete → restore → logout', async () => {
    const a = client()
    expect((await a.login('admin@test.local', 'wrong')).status).toBe(401)
    expect((await a.login('admin@test.local', 'Secret-pass-123')).status).toBe(200)
    expect((await a.get('/api/auth/me')).json.data.email).toBe('admin@test.local')

    for (const [code, name] of [['T-FIN', 'Finance'], ['T-PUR', 'Purchasing'], ['T-IT', 'Information Tech']]) {
      expect((await a.post('/api/departments', { code, name })).status).toBe(201)
    }
    expect((await a.post('/api/departments', { code: 'T-FIN', name: 'dup' })).status).toBe(409)

    const page = await a.get('/api/departments?q=t-&sort=name:desc&pageSize=2')
    expect(page.json.meta.total).toBe(3)
    expect(page.json.data.map((d: any) => d.name)).toEqual(['Purchasing', 'Information Tech'])
    expect((await a.get('/api/departments?q=purch')).json.data).toHaveLength(1)
    expect((await a.get('/api/departments?sort=evil:asc')).status).toBe(422)

    const fin = (await a.get('/api/departments?q=T-FIN')).json.data[0]
    const child = (await a.post('/api/departments', { code: 'T-FIN-AP', name: 'AP', parentId: fin.id })).json.data
    expect((await a.patch(`/api/departments/${fin.id}`, { parentId: child.id })).status).toBe(409) // cycle
    expect((await a.del(`/api/departments/${fin.id}`)).status).toBe(409) // has child
    expect((await a.del(`/api/departments/${child.id}`)).status).toBe(200)
    expect((await a.get('/api/departments?q=T-FIN-AP')).json.meta.total).toBe(0)
    expect((await a.get('/api/departments?deleted=true&q=T-FIN-AP')).json.meta.total).toBe(1)
    expect((await a.post(`/api/departments/${child.id}/restore`)).status).toBe(200)

    const audit = await sql(`SELECT count(*)::int n FROM hist_audit_log WHERE "TableName"='mst_department' AND "RecordKey"=$1`, [String(child.id)])
    expect(audit[0].n).toBeGreaterThanOrEqual(3)

    expect((await a.post('/api/auth/refresh')).status).toBe(200)
    expect((await a.post('/api/auth/logout')).status).toBe(200)
    expect((await a.get('/api/departments')).status).toBe(401)
  })

  it('permission and refresh-token reuse are enforced', async () => {
    const v = client()
    await v.login('viewer@test.local', 'Secret-pass-123')
    expect((await v.get('/api/departments')).status).toBe(200)
    expect((await v.post('/api/departments', { code: 'T-X', name: 'x' })).status).toBe(403)

    const stolen = v.jar.get('kpin_rt')!
    expect((await v.post('/api/auth/refresh')).status).toBe(200)
    const attacker = client(); attacker.jar.set('kpin_rt', stolen)
    expect((await attacker.post('/api/auth/refresh')).status).toBe(401) // reuse → whole session revoked
    expect((await v.post('/api/auth/refresh')).status).toBe(401)
  })

  it('locks out after 5 failures', async () => {
    await ensureUser('lock@test.local', 'Secret-pass-123', [])
    const c = client()
    for (let i = 0; i < 5; i++) await c.login('lock@test.local', 'bad')
    expect((await c.login('lock@test.local', 'Secret-pass-123')).status).toBe(429)
  })
})
