import type { Queryable } from '../../core/db'
import { runList, type ListQuery } from '../../core/list-query'
import { handoverList } from './handover.schema'

/** Final statuses: documents in these keep their historical owner. */
const FINAL = `('CLOSED','CANCELLED','REJECTED','WITHDRAWN','SUPERSEDED','NOT_AWARDED','RECEIVED','POSTED','EXPIRED','AWARDED')`

/** SQL only. Every move is logged to hist_handover_item. */
export class HandoverRepository {
  constructor(private q: Queryable) {}
  list(qs: ListQuery) { return runList(this.q, handoverList, qs) }
  async get(id: number) {
    const cols = Object.entries(handoverList.select).map(([k, c]) => `"${c}" AS "${k}"`).join(',')
    const h = (await this.q.query(`SELECT ${cols} FROM vw_wf_handover WHERE "Id"=$1`, [id]))[0]
    const items = await this.q.query(`SELECT "ItemType" AS "itemType", "RecordKey" AS "recordKey", "Detail" AS detail, "LoggedAt" AS "loggedAt" FROM hist_handover_item WHERE "HandoverId"=$1 ORDER BY "Id"`, [id])
    return h && { ...h, items }
  }
  async user(publicId: string) {
    return (await this.q.query<{ id: number; status: string }>(`SELECT "Id" AS id, "Status" AS status FROM mst_user WHERE "PublicId"=$1 AND "UserType"='INTERNAL'`, [publicId]))[0]
  }
  async create(d: { from: number; to: number; reason: string; effectiveDate: string; remarks?: string; executedBy: number }) {
    return (await this.q.query<{ id: number }>(
      `INSERT INTO tr_user_handover ("FromUserId","ToUserId","Reason","EffectiveDate","Remarks","ExecutedBy") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "Id" AS id`,
      [d.from, d.to, d.reason, d.effectiveDate, d.remarks ?? null, d.executedBy]))[0]!.id
  }
  private log(h: number, type: string, key: string, from: number, to: number | null, detail?: string) {
    return this.q.query(`INSERT INTO hist_handover_item ("HandoverId","ItemType","RecordKey","OldUserId","NewUserId","Detail") VALUES ($1,$2,$3,$4,$5,$6)`, [h, type, key, from, to, detail ?? null])
  }
  /** Move rows with UPDATE … RETURNING and log each one. */
  private async move(h: number, type: string, sql: string, from: number, to: number) {
    const rows = await this.q.query<{ k: string; d: string | null }>(sql, [from, to])
    for (const r of rows) await this.log(h, type, String(r.k), from, to, r.d ?? undefined)
    return rows.length
  }

  documents(h: number, from: number, to: number) {
    return this.move(h, 'DOCUMENT_OWNER', `UPDATE tr_document SET "OwnerUserId"=$2 WHERE "OwnerUserId"=$1 AND NOT "IsDeleted" AND "Status" NOT IN ${FINAL}
      RETURNING "Id"::text AS k, "DocType" || ' ' || COALESCE("DocNo",'(draft)') AS d`, from, to)
  }
  async mappings(h: number, from: number, to: number) {
    const a = await this.move(h, 'APPROVER_MAPPING', `UPDATE mst_approver_mapping m SET "ApproverUserId"=$2 WHERE "ApproverUserId"=$1 AND NOT "IsDeleted"
      AND NOT EXISTS (SELECT 1 FROM mst_approver_mapping x WHERE x."PreparerUserId"=m."PreparerUserId" AND x."DocType"=m."DocType" AND x."StepCode"=m."StepCode" AND x."ApproverUserId"=$2)
      AND m."PreparerUserId" <> $2 RETURNING "Id"::text AS k, "DocType" || '/' || "StepCode" AS d`, from, to)
    const b = await this.move(h, 'TEMPLATE_STEP', `UPDATE mst_approval_template_step SET "ApproverUserId"=$2 WHERE "ApproverUserId"=$1
      RETURNING "Id"::text AS k, 'template ' || "TemplateId" || ' step ' || "StepNo" AS d`, from, to)
    return a + b
  }
  async picRoles(h: number, from: number, to: number) {
    const rows = await this.q.query<{ bpId: number; role: string }>(
      `UPDATE mst_bp_internal_pic SET "IsActive"=false,"UpdatedAt"=now() WHERE "UserId"=$1 AND "IsActive" RETURNING "BpId" AS "bpId", "PicRole" AS role`, [from])
    for (const r of rows) {
      await this.q.query(`INSERT INTO mst_bp_internal_pic ("BpId","UserId","PicRole") VALUES ($1,$2,$3) ON CONFLICT ("BpId","UserId","PicRole") DO UPDATE SET "IsActive"=true,"UpdatedAt"=now()`, [r.bpId, to, r.role])
      await this.log(h, 'BP_PIC', `${r.bpId}|${r.role}`, from, to)
    }
    return rows.length
  }
  async orgRoles(h: number, from: number, to: number) {
    const a = await this.move(h, 'DEPARTMENT_HEAD', `UPDATE mst_department SET "HeadUserId"=$2 WHERE "HeadUserId"=$1 RETURNING "Id"::text AS k, "Code" AS d`, from, to)
    const b = await this.move(h, 'SUPERIOR', `UPDATE mst_employee SET "SuperiorUserId"=$2 WHERE "SuperiorUserId"=$1 AND "UserId" <> $2 RETURNING "UserId"::text AS k, "EmployeeNo" AS d`, from, to)
    return a + b
  }
  endEmployment(from: number, reason: string, date: string) {
    return this.q.query(`UPDATE mst_employee SET "EndDate"=$3,"EndReason"=$2 WHERE "UserId"=$1 AND "EndDate" IS NULL`, [from, reason, date])
  }
  complete(h: number, counts: { documents: number; mappings: number; picRoles: number; orgRoles: number }) {
    return this.q.query(`UPDATE tr_user_handover SET "Status"='COMPLETED',"CompletedAt"=now(),"DocumentsTransferred"=$2,"MappingsTransferred"=$3,"PicRolesTransferred"=$4,"OrgRolesTransferred"=$5 WHERE "Id"=$1`,
      [h, counts.documents, counts.mappings, counts.picRoles, counts.orgRoles])
  }
  async openTaskCount(userId: number) {
    return (await this.q.query<{ n: number }>(`SELECT count(*)::int n FROM tr_approval_task WHERE "AssigneeUserId"=$1 AND "Status" IN ('WAITING','PENDING')`, [userId]))[0]!.n
  }
}
