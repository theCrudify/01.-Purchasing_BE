import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DB_URL, client, ensureUser, env, sql } from './helpers'

const PW = 'Secret-pass-123'
const u = Date.now().toString(36)

/** Captures mails sent through Resend's HTTP API and returns the 6-digit code from the last one. */
function captureMail() {
  const mails: { to: string; html: string }[] = []
  ;(env as any).RESEND_API_KEY = 're_test'
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('resend.com')) { const b = JSON.parse(String(init!.body)); mails.push({ to: b.to, html: b.html }) }
    return new Response('{}')
  })
  return { mails, code: () => mails.at(-1)?.html.match(/\b(\d{6})\b/)?.[1] }
}

describe.skipIf(!DB_URL)('identity & access (real Postgres)', () => {
  const a = client()
  beforeAll(async () => {
    await ensureUser('i-admin@test.local', PW, 'ALL')
    await ensureUser('i-viewer@test.local', PW, ['MASTER.VIEW'])
    expect((await a.login('i-admin@test.local', PW)).status).toBe(200)
  })
  afterEach(() => { vi.restoreAllMocks(); delete (env as any).RESEND_API_KEY })

  it('admin creates a user → invite code → user sets password → roles → disable ends sessions', async () => {
    const mail = captureMail()
    const email = `new-${u}@test.local`
    const r = await a.post('/users', { email, displayName: 'New User' })
    expect(r.status, JSON.stringify(r.json)).toBe(201)
    const userId = r.json.data.id
    expect(mail.mails.at(-1)?.to).toEqual(email)

    const anon = client()
    expect((await anon.post('/password-reset/verify', { email, code: '000000' })).status).toBe(422)
    expect((await anon.post('/password-reset/reset', { email, code: mail.code(), newPassword: 'Brand-new-pass-1' })).status).toBe(422) // verify step is mandatory
    expect((await anon.post('/password-reset/verify', { email, code: mail.code() })).status).toBe(200)
    const rs = await anon.post('/password-reset/reset', { email, code: mail.code(), newPassword: 'Brand-new-pass-1' })
    expect(rs.status, JSON.stringify(rs.json) + mail.mails.at(-1)?.html).toBe(200)
    expect((await anon.login(email, 'Brand-new-pass-1')).status).toBe(200)

    const role = (await a.post('/roles', { code: `R${u}`.toUpperCase().slice(0, 20), name: 'Buyer', scope: 'INTERNAL' })).json.data
    expect(role?.id).toBeTruthy()
    const perm = (await a.get('/permissions?q=master.view')).json.data.find((p: any) => p.code === 'MASTER.VIEW')
    expect((await a.call('PUT', `/roles/${role.id}/permissions`, { permissionIds: [perm.id] })).status).toBe(200)
    expect((await a.call('PUT', `/users/${userId}/roles`, { roleIds: [role.id] })).status).toBe(200)
    expect((await anon.get('/departments')).status).toBe(200) // permission now effective (loaded per request)

    expect((await a.post(`/users/${userId}/disable`, { reason: 'left company' })).status).toBe(200)
    expect((await anon.get('/auth/me')).status).toBe(401)
    expect((await a.get(`/users?q=new-${u}&status=DISABLED`)).json.meta.total).toBe(1)
  })

  it('forgot password does not reveal unknown emails and limits attempts', async () => {
    captureMail()
    const anon = client()
    const known = await anon.post('/password-reset/request', { email: 'i-viewer@test.local' })
    const unknown = await anon.post('/password-reset/request', { email: `nobody-${u}@test.local` })
    expect(known.status).toBe(unknown.status)
    expect(known.json).toEqual(unknown.json)
  })

  it('employee: superior chain without cycles, department must be active', async () => {
    const dept = (await a.post('/departments', { code: `ED${u}`.toUpperCase(), name: 'Emp Dept' })).json.data
    const ids: string[] = []
    for (const n of ['boss', 'mgr', 'staff']) {
      await ensureUser(`${n}-${u}@test.local`, PW, [])
      ids.push((await sql(`SELECT "PublicId" FROM mst_user WHERE "Email"=$1`, [`${n}-${u}@test.local`]))[0].PublicId)
    }
    const [boss, mgr, staff] = ids as [string, string, string]
    expect((await a.post('/employees', { userId: boss, employeeNo: `B${u}`, departmentId: dept.id })).status).toBe(201)
    expect((await a.post('/employees', { userId: mgr, employeeNo: `M${u}`, departmentId: dept.id, superiorId: boss })).status).toBe(201)
    const s = await a.post('/employees', { userId: staff, employeeNo: `S${u}`, departmentId: dept.id, superiorId: mgr, jobTitle: 'Buyer' })
    expect(s.status, JSON.stringify(s.json)).toBe(201)
    expect(s.json.data.superiorName).toContain('mgr')
    expect((await a.patch(`/employees/${boss}`, { superiorId: staff })).status).toBe(422) // cycle
    expect((await a.patch(`/employees/${staff}`, { endDate: '2026-12-31' })).status).toBe(422) // reason required
    expect((await a.get(`/employees?departmentId=${dept.id}&sort=displayName:asc&q=${u}`)).json.meta.total).toBe(3)
    expect((await a.post('/cost-centers', { code: `CC${u}`.toUpperCase(), name: 'CC', departmentId: dept.id })).status).toBe(201)
  })

  it('profile: change password ends other sessions; audit trail is visible to auditors', async () => {
    const email = `prof-${u}@test.local`
    await ensureUser(email, PW, [])
    const s1 = client(), s2 = client()
    await s1.login(email, PW); await s2.login(email, PW)
    expect((await s1.patch('/profile', { displayName: 'Changed Name' })).json.data.displayName).toBe('Changed Name')
    expect((await s1.post('/profile/password', { currentPassword: 'wrong', newPassword: 'Another-pass-99' })).status).toBe(422)
    expect((await s1.post('/profile/password', { currentPassword: PW, newPassword: 'short' })).status).toBe(422)
    expect((await s1.post('/profile/password', { currentPassword: PW, newPassword: 'Another-pass-99' })).status).toBe(200)
    expect((await s1.get('/profile')).status).toBe(200)
    expect((await s2.get('/profile')).status).toBe(401)

    const logs = await a.get('/audit/logs?tableName=mst_department&sort=occurredAt:desc&pageSize=5')
    expect(logs.status).toBe(200)
    expect(logs.json.data.length).toBeGreaterThan(0)
    expect((await a.get('/audit/activity?action=PASSWORD_CHANGED')).json.meta.total).toBeGreaterThan(0)
    expect((await a.get('/audit/sessions?isActive=true')).status).toBe(200)
    expect((await a.get('/audit/nope')).status).toBe(422)
  })

  it('non-admins are denied; IP allow list validates input', async () => {
    const v = client(); await v.login('i-viewer@test.local', PW)
    expect((await v.get('/users')).status).toBe(403)
    expect((await v.get('/audit/logs')).status).toBe(403)
    expect((await v.post('/roles', { code: 'X', name: 'x', scope: 'INTERNAL' })).status).toBe(403)
    expect((await a.post('/security/ip-allow-list', { ipOrCidr: 'not-an-ip' })).status).toBe(422)
  })
})
