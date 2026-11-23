import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/core/db'
import { createDraft } from '../src/modules/document/document.core'
import { submitForApproval } from '../src/modules/approval/approval.engine'
import { DB_URL, client, ensureUser, env, sql } from './helpers'

const PW = 'Secret-pass-123'
const u = Date.now().toString(36)
type Ids = Record<string, number>

/** Creates a PR draft (core + subtype row) owned by `owner` and returns its ids. */
async function makePr(owner: number, total = '5000000.00', deptId: number | null = null, pcId = 0) {
  const db = createDb(DB_URL!)
  return db.session({ id: owner, userType: 'INTERNAL' }, async (q) => {
    const d = await createDraft(q, { id: owner, userType: 'INTERNAL' }, 'PR', { title: `PR test ${u}`, currencyCode: 'IDR', departmentId: deptId })
    await q.query(`INSERT INTO tr_purchase_request ("DocumentId","RequiredDate","PurchaseClassId") VALUES ($1, current_date + 7, $2)`, [d.id, pcId])
    await q.query(`UPDATE tr_document SET "TotalAmount"=$2 WHERE "Id"=$1`, [d.id, total]) // stands in for the PR line triggers
    return d
  })
}
async function submit(owner: number, docId: number) {
  return createDb(DB_URL!).session({ id: owner, userType: 'INTERNAL' }, (q) => submitForApproval(q, { id: owner, userType: 'INTERNAL' }, docId))
}
const taskOf = async (docId: number, userId: number) =>
  (await sql(`SELECT t."PublicId" FROM tr_approval_task t JOIN tr_approval_request r ON r."Id"=t."ApprovalRequestId" WHERE r."DocumentId"=$1 AND t."AssigneeUserId"=$2 AND t."Status"='PENDING'`, [docId, userId]))[0]?.PublicId

describe.skipIf(!DB_URL)('workflow: document core + approval engine (real Postgres)', () => {
  const ids: Ids = {}
  const c: Record<string, ReturnType<typeof client>> = {}
  let pcId = 0, deptId = 0

  beforeAll(async () => {
    for (const n of ['req', 'boss', 'dir', 'cfg', 'deleg', 'backup', 'other']) {
      ids[n] = await ensureUser(`wf-${n}-${u}@test.local`, PW, n === 'cfg' ? 'ALL' : n === 'req' ? ['PR.CREATE'] : [])
      c[n] = client(); expect((await c[n]!.login(`wf-${n}-${u}@test.local`, PW)).status).toBe(200)
    }
    deptId = (await sql(`INSERT INTO mst_department ("Code","Name") VALUES ($1,'WF Dept') RETURNING "Id"`, [`WF${u}`]))[0].Id
    pcId = (await sql(`INSERT INTO mst_purchase_class ("Code","Name") VALUES ($1,'WF class') RETURNING "Id"`, [`WF${u}`]))[0].Id
    await sql(`INSERT INTO mst_employee ("UserId","EmployeeNo","DepartmentId") VALUES ($1,$2,$3)`, [ids.dir, `E3${u}`, deptId])
    await sql(`INSERT INTO mst_employee ("UserId","EmployeeNo","DepartmentId","SuperiorUserId") VALUES ($1,$2,$3,$4)`, [ids.boss, `E2${u}`, deptId, ids.dir])
    await sql(`INSERT INTO mst_employee ("UserId","EmployeeNo","DepartmentId","SuperiorUserId") VALUES ($1,$2,$3,$4)`, [ids.req, `E1${u}`, deptId, ids.boss])
    // template: step 1 = requester's superior, step 2 = director (user). Only for this department.
    const t = await c.cfg!.post('/approval-templates', { code: `PR-${u}`, name: 'PR test', docType: 'PR', departmentId: deptId, effectiveFrom: '2020-01-01', priority: 1 })
    expect(t.status, JSON.stringify(t.json)).toBe(201)
    const dirPub = (await sql(`SELECT "PublicId" FROM mst_user WHERE "Id"=$1`, [ids.dir]))[0].PublicId
    const s = await c.cfg!.call('PUT', `/approval-templates/${t.json.data.id}/steps`, { steps: [
      { name: 'Superior', approverType: 'SUPERIOR' },
      { name: 'Director', approverType: 'USER', approverUserId: dirPub },
    ] })
    expect(s.status, JSON.stringify(s.json)).toBe(200)
    expect((await c.cfg!.call('PUT', `/approval-templates/${t.json.data.id}/steps`, { steps: [{ name: 'x', approverType: 'USER' }] })).status).toBe(422)
  })
  afterEach(() => { vi.restoreAllMocks(); delete (env as any).RESEND_API_KEY })

  it('submit → numbered → step 1 → step 2 → APPROVED, with history, notifications and visibility', async () => {
    const d = await makePr(ids.req!, '5000000.00', deptId, pcId)
    const r = await submit(ids.req!, d.id)
    expect(r.roundNo).toBe(1)
    const doc = (await sql(`SELECT "DocNo","Status" FROM tr_document WHERE "Id"=$1`, [d.id]))[0]
    expect(doc.Status).toBe('PENDING_APPROVAL')
    expect(doc.DocNo).toMatch(/^PR\/\d{4}\/\d{4}$/)

    expect((await c.other!.get(`/documents/${d.publicId}`)).status).toBe(404) // not a participant
    expect((await c.dir!.get('/approvals/tasks')).json.meta.total).toBe(0) // step 2 still waiting
    const inbox = await c.boss!.get('/approvals/tasks?q=PR&sort=startedAt:asc')
    expect(inbox.json.data.map((x: any) => x.documentId)).toContain(d.publicId)
    const t1 = inbox.json.data.find((x: any) => x.documentId === d.publicId).id

    expect((await c.boss!.post(`/approvals/tasks/${t1}/decide`, { decision: 'REJECT' })).status).toBe(422) // remarks required
    expect((await c.boss!.post(`/approvals/tasks/${t1}/decide`, { decision: 'APPROVE' })).status).toBe(200)
    expect((await c.boss!.post(`/approvals/tasks/${t1}/decide`, { decision: 'APPROVE' })).status).toBe(422) // already decided

    const t2 = await taskOf(d.id, ids.dir!)
    const fin = await c.dir!.post(`/approvals/tasks/${t2}/decide`, { decision: 'APPROVE', remarks: 'ok' })
    expect(fin.json.data).toMatchObject({ outcome: 'APPROVED', documentStatus: 'APPROVED' })

    const view = await c.req!.get(`/documents/${d.publicId}`)
    expect(view.status).toBe(200)
    expect(view.json.data.history.map((h: any) => h.toStatus)).toEqual(['DRAFT', 'PENDING_APPROVAL', 'APPROVED'])
    expect(view.json.data.approvals).toHaveLength(2)
    expect((await c.req!.get('/notifications?unread=true')).json.data.some((n: any) => n.eventType === 'APPROVAL_APPROVED')).toBe(true)
    expect((await c.req!.get('/dashboard')).json.data.myDocuments.length).toBeGreaterThan(0)
  })

  it('return → resubmit (round 2) → reject; requester cannot approve own; delete rules', async () => {
    const d = await makePr(ids.req!, '100.00', deptId, pcId)
    await submit(ids.req!, d.id)
    const t1 = await taskOf(d.id, ids.boss!)
    expect((await c.boss!.post(`/approvals/tasks/${t1}/decide`, { decision: 'RETURN', remarks: 'fix qty' })).json.data.documentStatus).toBe('RETURNED')
    expect((await sql(`SELECT "Status" FROM tr_document WHERE "Id"=$1`, [d.id]))[0].Status).toBe('RETURNED')
    expect((await submit(ids.req!, d.id)).roundNo).toBe(2)
    const t2 = await taskOf(d.id, ids.boss!)
    expect((await c.boss!.post(`/approvals/tasks/${t2}/decide`, { decision: 'REJECT', remarks: 'no budget' })).json.data.documentStatus).toBe('REJECTED')

    expect((await c.req!.post(`/documents/${d.publicId}/delete`, { reason: 'x' })).status).toBe(422) // reason too short
    expect((await c.req!.post(`/documents/${d.publicId}/delete`, { reason: 'rejected, not needed' })).status).toBe(403) // not DRAFT → needs DOC.DELETE
    expect((await c.cfg!.post(`/documents/${d.publicId}/delete`, { reason: 'rejected, not needed' })).status).toBe(200)
    expect((await c.cfg!.get('/documents/deleted?docType=PR')).json.data.some((x: any) => x.id === d.publicId)).toBe(true)
    expect((await c.cfg!.post(`/documents/${d.publicId}/restore`)).status).toBe(200)
  })

  it('delegation and backup can act; DB rejects inconsistent status', async () => {
    const d = await makePr(ids.req!, '100.00', deptId, pcId)
    await submit(ids.req!, d.id)
    const delegPub = (await sql(`SELECT "PublicId" FROM mst_user WHERE "Id"=$1`, [ids.deleg]))[0].PublicId
    const now = Date.now()
    const g = await c.boss!.post('/approvals/delegations', { toId: delegPub, docType: 'PR', startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 86_400_000).toISOString() })
    expect(g.status, JSON.stringify(g.json)).toBe(201)
    expect((await c.boss!.post('/approvals/delegations', { toId: delegPub, docType: 'PR', startsAt: new Date(now).toISOString(), endsAt: new Date(now + 1000_000).toISOString() })).status).toBe(409)
    const inbox = await c.deleg!.get('/approvals/tasks')
    const t = inbox.json.data.find((x: any) => x.documentId === d.publicId)
    expect(t).toBeTruthy()
    expect((await c.deleg!.post(`/approvals/tasks/${t.id}/decide`, { decision: 'APPROVE' })).status).toBe(200)
    expect((await sql(`SELECT "ActingAs" FROM tr_approval_task WHERE "PublicId"=$1`, [t.id]))[0].ActingAs).toBe('DELEGATE')

    // director's backup takes over step 2
    const [dirPub, backupPub] = (await sql(`SELECT "PublicId" FROM mst_user WHERE "Id" IN ($1,$2) ORDER BY ("Id"=$1) DESC`, [ids.dir, ids.backup])).map((x: any) => x.PublicId)
    expect((await c.dir!.post('/approvals/backups', { approverId: dirPub, backupId: backupPub })).status).toBe(201)
    expect((await c.other!.post('/approvals/backups', { approverId: dirPub, backupId: backupPub })).status).toBe(403)
    const bt = (await c.backup!.get('/approvals/tasks')).json.data.find((x: any) => x.documentId === d.publicId)
    expect((await c.backup!.post(`/approvals/tasks/${bt.id}/decide`, { decision: 'APPROVE' })).json.data.outcome).toBe('APPROVED')

    await expect(sql(`UPDATE tr_document SET "Status"='PENDING_APPROVAL' WHERE "Id"=$1`, [d.id])).rejects.toThrow(/E51011|not allowed/)
  })

  it('attachments + comments; cron needs the secret and sends queued e-mails', async () => {
    const d = await makePr(ids.req!, '100.00', deptId, pcId)
    const fd = new FormData()
    fd.set('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'spec.pdf', { type: 'application/pdf' }))
    fd.set('category', 'SPECIFICATION')
    const { app } = await import('../src/index')
    const cookie = [...c.req!.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    const up = await app.request(`/api/documents/${d.publicId}/attachments`, { method: 'POST', body: fd, headers: { origin: 'http://localhost:3000', cookie } }, env, { waitUntil() {}, passThroughOnException() {} } as any)
    expect(up.status, await up.clone().text()).toBe(201)
    const bad = new FormData(); bad.set('file', new File(['<html>'], 'x.pdf'))
    expect((await app.request(`/api/documents/${d.publicId}/attachments`, { method: 'POST', body: bad, headers: { origin: 'http://localhost:3000', cookie } }, env, { waitUntil() {} } as any)).status).toBe(422)
    const list = await c.req!.get(`/documents/${d.publicId}/attachments`)
    expect(list.json.data).toHaveLength(1)
    const dl = await app.request(`/api/documents/${d.publicId}/attachments/${list.json.data[0].id}`, { headers: { cookie } }, env, { waitUntil() {} } as any)
    expect(dl.headers.get('content-disposition')).toMatch(/attachment/)
    expect((await c.req!.post(`/documents/${d.publicId}/comments`, { body: 'please check spec' })).status).toBe(201)

    expect((await c.cfg!.call('POST', '/cron/dispatch')).status).toBe(401)
    ;(env as any).RESEND_API_KEY = 're_test'
    const sent: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => { sent.push(JSON.parse(String(init!.body)).subject); return new Response('{}') })
    await sql(`INSERT INTO tr_notification ("RecipientUserId","EventType","Title","EmailStatus") VALUES ($1,'TEST','Queued mail','QUEUED')`, [ids.req])
    const run = await client().call('POST', '/cron/dispatch', {}, { 'x-cron-secret': env.CRON_SECRET })
    expect(run.status).toBe(200)
    expect(run.json.data.sent).toBeGreaterThan(0)
    expect(sent).toContain('Queued mail')
  })

  it('reassignment needs a superior; handover moves documents and raises a reassignment', async () => {
    const d = await makePr(ids.req!, '100.00', deptId, pcId)
    await submit(ids.req!, d.id)
    const pub = async (n: string) => (await sql(`SELECT "PublicId" FROM mst_user WHERE "Id"=$1`, [ids[n]]))[0].PublicId
    // boss's superior is dir
    expect((await c.boss!.post('/reassignments', { fromId: await pub('boss'), toId: await pub('other'), approverId: await pub('other'), reason: 'WORKLOAD', remarks: 'busy' })).status).toBe(422)
    const ra = await c.boss!.post('/reassignments', { fromId: await pub('boss'), toId: await pub('other'), approverId: await pub('dir'), reason: 'WORKLOAD', remarks: 'busy' })
    expect(ra.status, JSON.stringify(ra.json)).toBe(201)
    expect((await c.other!.post(`/reassignments/${ra.json.data.id}/decide`, { decision: 'APPROVE' })).status).toBe(403)
    expect((await c.dir!.post(`/reassignments/${ra.json.data.id}/decide`, { decision: 'APPROVE' })).json.data.moved).toBeGreaterThan(0)
    expect(await taskOf(d.id, ids.other!)).toBeTruthy()

    const draft = await makePr(ids.req!, '1.00', deptId, pcId)
    const h = await c.cfg!.post('/handovers', { fromId: await pub('req'), toId: await pub('other'), reason: 'TRANSFERRED', effectiveDate: '2026-12-01', remarks: 'moved to plant' })
    expect(h.status, JSON.stringify(h.json)).toBe(201)
    expect(h.json.data.documents).toBeGreaterThan(0)
    expect((await sql(`SELECT "OwnerUserId" FROM tr_document WHERE "Id"=$1`, [draft.id]))[0].OwnerUserId).toBe(ids.other)
    expect((await c.cfg!.get(`/handovers/${h.json.data.id}`)).json.data.items.length).toBeGreaterThan(0)
  })
})
