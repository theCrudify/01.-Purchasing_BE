import type { Queryable } from '../../core/db'
import { runList, type ListConfig, type ListQuery } from '../../core/list-query'
import { backupList, delegationList, mappingList, taskList, type StepsBody, type TaskListQuery } from './approval.schema'

const actableByUser = `(t."AssigneeUserId"=$1
  OR EXISTS (SELECT 1 FROM mst_approval_delegation g WHERE g."FromUserId"=t."AssigneeUserId" AND g."ToUserId"=$1 AND g."RevokedAt" IS NULL
             AND now() >= g."StartsAt" AND now() < g."EndsAt" AND (g."DocType" IS NULL OR g."DocType"=t."DocType") AND (g."DocumentId" IS NULL OR g."DocumentId"=t."DocumentId"))
  OR EXISTS (SELECT 1 FROM mst_approval_backup b WHERE b."ApproverUserId"=t."AssigneeUserId" AND b."BackupUserId"=$1 AND b."IsActive" AND NOT b."IsDeleted"))`

/** SQL only: approval inbox, history and configuration lists. */
export class ApprovalConfigRepository {
  constructor(private q: Queryable) {}

  private withDocType(cfg: ListConfig, qs: ListQuery & { docType?: string }, where: string[], params: unknown[]) {
    if (qs.docType) { params.push(qs.docType); where.push(`t."DocType"=$${params.length}`) }
    return runList(this.q, cfg, qs, { where, params })
  }
  /** PENDING tasks the user may act on: own, delegated to them, or as backup. */
  inbox(userId: number, qs: TaskListQuery) { return this.withDocType(taskList, qs, [`t."Status"='PENDING'`, `NOT t."IsDeleted"`, actableByUser], [userId]) }
  /** Tasks the user decided. */
  decided(userId: number, qs: TaskListQuery) {
    return this.withDocType({ ...taskList, defaultSort: 'actedAt:desc' }, qs, [`t."ActedByUserId"=$1`, `t."Status" IN ('APPROVED','REJECTED','RETURNED')`], [userId])
  }
  async inboxCount(userId: number) {
    return (await this.q.query<{ n: number }>(`SELECT count(*)::int n FROM vw_wf_task t WHERE t."Status"='PENDING' AND NOT t."IsDeleted" AND ${actableByUser}`, [userId]))[0]!.n
  }

  async userId(publicId: string, internalOnly = true) {
    return (await this.q.query<{ id: number }>(`SELECT "Id" AS id FROM mst_user WHERE "PublicId"=$1 ${internalOnly ? `AND "UserType"='INTERNAL'` : ''}`, [publicId]))[0]?.id
  }

  // ---- template steps
  steps(templateId: number) {
    return this.q.query(
      `SELECT s."StepNo" AS "stepNo", s."Name" AS name, s."StepCode" AS "stepCode", s."ApproverType" AS "approverType", u."PublicId" AS "approverUserId", u."DisplayName" AS "approverUserName",
              s."ApproverRoleId" AS "approverRoleId", r."Code" AS "approverRoleCode", s."PicRole" AS "picRole", s."RequiredApprovals" AS "requiredApprovals", s."IsOptional" AS "isOptional"
         FROM mst_approval_template_step s LEFT JOIN mst_user u ON u."Id"=s."ApproverUserId" LEFT JOIN mst_role r ON r."Id"=s."ApproverRoleId"
        WHERE s."TemplateId"=$1 ORDER BY s."StepNo"`, [templateId])
  }
  /** Replace all steps; refused while the template has an open round (running approvals keep their plan). */
  async hasOpenRounds(templateId: number) { return (await this.q.query(`SELECT 1 FROM tr_approval_request WHERE "TemplateId"=$1 AND "Status"='PENDING' LIMIT 1`, [templateId])).length > 0 }
  async replaceSteps(templateId: number, steps: (StepsBody['steps'][number] & { approverUserNumId: number | null })[]) {
    await this.q.query(`DELETE FROM mst_approval_template_step WHERE "TemplateId"=$1`, [templateId])
    for (const [i, s] of steps.entries()) {
      await this.q.query(
        `INSERT INTO mst_approval_template_step ("TemplateId","StepNo","Name","StepCode","ApproverType","ApproverUserId","ApproverRoleId","PicRole","RequiredApprovals","IsOptional")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [templateId, i + 1, s.name, s.stepCode ?? null, s.approverType, s.approverUserNumId, s.approverRoleId ?? null, s.picRole ?? null, s.requiredApprovals ?? 1, s.isOptional ?? false])
    }
  }

  // ---- approver mappings
  mappings(qs: ListQuery & { docType?: string }) { return this.withDocType(mappingList, qs, [`NOT t."IsDeleted"`], []) }
  async addMapping(preparer: number, approver: number, docType: string, stepCode: string, actorId: number) {
    return (await this.q.query<{ id: number }>(
      `INSERT INTO mst_approver_mapping ("PreparerUserId","ApproverUserId","DocType","StepCode","CreatedBy","UpdatedBy") VALUES ($1,$2,$3,$4,$5,$5) RETURNING "Id" AS id`,
      [preparer, approver, docType, stepCode, actorId]))[0]!.id
  }
  async removeMapping(id: number, actorId: number) {
    return (await this.q.query(`UPDATE mst_approver_mapping SET "IsDeleted"=true,"IsActive"=false,"DeletedAt"=now(),"DeletedBy"=$2 WHERE "Id"=$1 AND NOT "IsDeleted" RETURNING 1`, [id, actorId])).length > 0
  }

  // ---- backups
  backups(qs: ListQuery, approverId?: number) {
    const where = [`NOT t."IsDeleted"`], params: unknown[] = []
    if (approverId) { params.push(approverId); where.push(`t."Id" IN (SELECT "Id" FROM mst_approval_backup WHERE "ApproverUserId"=$1)`) }
    return runList(this.q, backupList, qs, { where, params })
  }
  async addBackup(approver: number, backup: number, notes: string | null, actorId: number) {
    return (await this.q.query<{ id: number }>(
      `INSERT INTO mst_approval_backup ("ApproverUserId","BackupUserId","Notes","CreatedBy","UpdatedBy") VALUES ($1,$2,$3,$4,$4)
       ON CONFLICT ("ApproverUserId","BackupUserId") DO UPDATE SET "IsActive"=true,"IsDeleted"=false,"DeletedAt"=NULL,"DeletedBy"=NULL,"Notes"=EXCLUDED."Notes","UpdatedBy"=$4
       RETURNING "Id" AS id`, [approver, backup, notes, actorId]))[0]!.id
  }
  async backupOwner(id: number) { return (await this.q.query<{ a: number }>(`SELECT "ApproverUserId" AS a FROM mst_approval_backup WHERE "Id"=$1 AND NOT "IsDeleted"`, [id]))[0]?.a }
  removeBackup(id: number, actorId: number) {
    return this.q.query(`UPDATE mst_approval_backup SET "IsDeleted"=true,"IsActive"=false,"DeletedAt"=now(),"DeletedBy"=$2 WHERE "Id"=$1`, [id, actorId])
  }

  // ---- delegations
  delegations(qs: ListQuery, userId?: number) {
    const where: string[] = [], params: unknown[] = []
    if (userId) { params.push(userId); where.push(`(t."FromUserId"=$1 OR t."ToUserId"=$1)`) }
    return runList(this.q, delegationList, qs, { where, params })
  }
  async overlappingDelegation(from: number, docType: string | null, startsAt: string, endsAt: string) {
    return (await this.q.query(
      `SELECT 1 FROM mst_approval_delegation WHERE "FromUserId"=$1 AND "RevokedAt" IS NULL AND "DocumentId" IS NULL
         AND ("DocType" IS NOT DISTINCT FROM $2 OR "DocType" IS NULL OR $2::text IS NULL) AND "StartsAt" < $4::timestamptz AND "EndsAt" > $3::timestamptz LIMIT 1`,
      [from, docType, startsAt, endsAt])).length > 0
  }
  async addDelegation(from: number, to: number, docType: string | null, startsAt: string, endsAt: string, reason: string | null, actorId: number) {
    return (await this.q.query<{ id: number }>(
      `INSERT INTO mst_approval_delegation ("FromUserId","ToUserId","DocType","StartsAt","EndsAt","Reason","CreatedBy") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "Id" AS id`,
      [from, to, docType, startsAt, endsAt, reason, actorId]))[0]!.id
  }
  async delegationFrom(id: number) { return (await this.q.query<{ f: number }>(`SELECT "FromUserId" AS f FROM mst_approval_delegation WHERE "Id"=$1 AND "RevokedAt" IS NULL`, [id]))[0]?.f }
  revokeDelegation(id: number) { return this.q.query(`UPDATE mst_approval_delegation SET "RevokedAt"=now() WHERE "Id"=$1`, [id]) }
}
