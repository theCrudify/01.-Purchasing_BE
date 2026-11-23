import type { Queryable } from '../../core/db'

export type TemplateRow = { id: number; code: string; name: string }
export type StepRow = {
  stepNo: number; name: string; stepCode: string | null; approverType: string; approverUserId: number | null
  approverRoleId: number | null; picRole: string | null; requiredApprovals: number; isOptional: boolean
}
export type TaskRow = {
  id: number; publicId: string; requestId: number; stepNo: number; assigneeUserId: number; status: string; version: number
  documentId: number; roundNo: number; templateId: number
}
export type ActingAs = 'SELF' | 'DELEGATE' | 'BACKUP'

const TASK_COLS = `t."Id" AS id, t."PublicId" AS "publicId", t."ApprovalRequestId" AS "requestId", t."StepNo" AS "stepNo",
  t."AssigneeUserId" AS "assigneeUserId", t."Status" AS status, t."Version" AS version,
  r."DocumentId" AS "documentId", r."RoundNo" AS "roundNo", r."TemplateId" AS "templateId"`

/** SQL only for approval rounds and tasks. */
export class ApprovalRepository {
  constructor(private q: Queryable) {}

  /** Most specific active template: lowest Priority first, then the narrower match. Amount is IDR, Min inclusive / Max exclusive. */
  async findTemplate(docType: string, amountBase: string | null, departmentId: number | null, purchaseClassId: number | null, date: string) {
    return (await this.q.query<TemplateRow>(
      `SELECT "Id" AS id, "Code" AS code, "Name" AS name FROM mst_approval_template
        WHERE "DocType"=$1 AND "IsActive" AND NOT "IsDeleted" AND "EffectiveFrom" <= $5::date AND ("EffectiveTo" IS NULL OR "EffectiveTo" >= $5::date)
          AND ("MinAmountBase" IS NULL OR COALESCE($2::numeric,0) >= "MinAmountBase") AND ("MaxAmountBase" IS NULL OR COALESCE($2::numeric,0) < "MaxAmountBase")
          AND ("DepartmentId" IS NULL OR "DepartmentId" = $3) AND ("PurchaseClassId" IS NULL OR "PurchaseClassId" = $4)
        ORDER BY "Priority", ("DepartmentId" IS NULL), ("PurchaseClassId" IS NULL), "MinAmountBase" DESC NULLS LAST, "Id" LIMIT 1`,
      [docType, amountBase, departmentId, purchaseClassId, date]))[0]
  }

  steps(templateId: number) {
    return this.q.query<StepRow>(
      `SELECT "StepNo" AS "stepNo", "Name" AS name, "StepCode" AS "stepCode", "ApproverType" AS "approverType", "ApproverUserId" AS "approverUserId",
              "ApproverRoleId" AS "approverRoleId", "PicRole" AS "picRole", "RequiredApprovals" AS "requiredApprovals", "IsOptional" AS "isOptional"
         FROM mst_approval_template_step WHERE "TemplateId"=$1 ORDER BY "StepNo"`, [templateId])
  }

  /** Candidate approvers of one step for a document (ACTIVE users only). */
  async resolveStep(s: StepRow, doc: { id: number; docType: string; ownerUserId: number; departmentId: number | null; bpId: number | null }) {
    const active = (sql: string, p: unknown[]) => this.q.query<{ id: number }>(`SELECT u."Id" AS id FROM mst_user u WHERE u."Status"='ACTIVE' AND u."Id" IN (${sql})`, p).then((r) => r.map((x) => x.id))
    switch (s.approverType) {
      case 'USER': return active(`$1`, [s.approverUserId])
      case 'ROLE': return active(`SELECT "UserId" FROM mst_user_role WHERE "RoleId"=$1`, [s.approverRoleId])
      case 'REQUESTER_PICK':
      case 'PREPARER_MAPPING_PICK': return active(`SELECT "UserId" FROM tr_document_approver_pick WHERE "DocumentId"=$1 AND "StepCode"=$2`, [doc.id, s.stepCode])
      case 'PREPARER_MAPPING':
        return active(`SELECT "ApproverUserId" FROM mst_approver_mapping WHERE "PreparerUserId"=$1 AND "DocType"=$2 AND "StepCode"=$3 AND "IsActive" AND NOT "IsDeleted"`,
          [doc.ownerUserId, doc.docType, s.stepCode])
      case 'SUPERIOR': return active(`SELECT "SuperiorUserId" FROM mst_employee WHERE "UserId"=$1 AND "IsActive"`, [doc.ownerUserId])
      case 'DEPARTMENT_HEAD': return active(`SELECT "HeadUserId" FROM mst_department WHERE "Id"=$1`, [doc.departmentId])
      case 'BP_PIC': return active(`SELECT "UserId" FROM mst_bp_internal_pic WHERE "BpId"=$1 AND "PicRole"=$2 AND "IsActive"`, [doc.bpId, s.picRole])
      default: return []
    }
  }

  /** Users allowed for a pick step: role pool, mapping pool, or any active internal user. */
  async pickPool(s: StepRow, ownerUserId: number, docType: string) {
    if (s.approverType === 'PREPARER_MAPPING_PICK') {
      return (await this.q.query<{ id: number }>(`SELECT "ApproverUserId" AS id FROM mst_approver_mapping WHERE "PreparerUserId"=$1 AND "DocType"=$2 AND "StepCode"=$3 AND "IsActive" AND NOT "IsDeleted"`,
        [ownerUserId, docType, s.stepCode])).map((r) => r.id)
    }
    if (s.approverRoleId) return (await this.q.query<{ id: number }>(`SELECT "UserId" AS id FROM mst_user_role WHERE "RoleId"=$1`, [s.approverRoleId])).map((r) => r.id)
    return null // any internal user
  }
  async userIdsByPublicIds(ids: string[]) {
    return this.q.query<{ id: number; publicId: string }>(`SELECT "Id" AS id, "PublicId" AS "publicId" FROM mst_user WHERE "PublicId" = ANY($1::uuid[]) AND "UserType"='INTERNAL' AND "Status"='ACTIVE'`, [ids])
  }
  async savePicks(docId: number, picks: { stepCode: string; userId: number }[], actorId: number) {
    await this.q.query(`DELETE FROM tr_document_approver_pick WHERE "DocumentId"=$1`, [docId])
    for (const p of picks) await this.q.query(`INSERT INTO tr_document_approver_pick ("DocumentId","StepCode","UserId","CreatedBy") VALUES ($1,$2,$3,$4)`, [docId, p.stepCode, p.userId, actorId])
  }

  async openRound(docId: number, templateId: number) {
    return (await this.q.query<{ id: number; roundNo: number }>(
      `INSERT INTO tr_approval_request ("DocumentId","TemplateId","RoundNo")
       VALUES ($1,$2,(SELECT COALESCE(max("RoundNo"),0)+1 FROM tr_approval_request WHERE "DocumentId"=$1)) RETURNING "Id" AS id, "RoundNo" AS "roundNo"`, [docId, templateId]))[0]!
  }
  async addTask(requestId: number, stepNo: number, assignee: number, status: 'WAITING' | 'PENDING', replacesTaskId: number | null = null) {
    return (await this.q.query<{ id: number }>(
      `INSERT INTO tr_approval_task ("ApprovalRequestId","StepNo","AssigneeUserId","Status","ReplacesTaskId") VALUES ($1,$2,$3,$4,$5) RETURNING "Id" AS id`,
      [requestId, stepNo, assignee, status, replacesTaskId]))[0]!.id
  }
  async openRequest(docId: number) {
    return (await this.q.query<{ id: number; templateId: number; roundNo: number }>(
      `SELECT "Id" AS id, "TemplateId" AS "templateId", "RoundNo" AS "roundNo" FROM tr_approval_request WHERE "DocumentId"=$1 AND "Status"='PENDING' FOR UPDATE`, [docId]))[0]
  }
  closeRound(requestId: number, status: string) {
    return this.q.query(`UPDATE tr_approval_request SET "Status"=$2,"CompletedAt"=now() WHERE "Id"=$1`, [requestId, status])
  }
  /** Cancel the open round (document cancelled / withdrawn): open tasks become CANCELLED. */
  async cancelOpenRound(docId: number, remarks: string) {
    const r = await this.openRequest(docId)
    if (!r) return
    await this.q.query(`UPDATE tr_approval_task SET "Status"='CANCELLED',"Remarks"=left($2,1000) WHERE "ApprovalRequestId"=$1 AND "Status" IN ('WAITING','PENDING')`, [r.id, remarks])
    await this.closeRound(r.id, 'CANCELLED')
  }

  async taskByPublicId(publicId: string, lock = false) {
    return (await this.q.query<TaskRow>(`SELECT ${TASK_COLS} FROM tr_approval_task t JOIN tr_approval_request r ON r."Id"=t."ApprovalRequestId" WHERE t."PublicId"=$1${lock ? ' FOR UPDATE OF t' : ''}`, [publicId]))[0]
  }
  async taskById(id: number) {
    return (await this.q.query<TaskRow>(`SELECT ${TASK_COLS} FROM tr_approval_task t JOIN tr_approval_request r ON r."Id"=t."ApprovalRequestId" WHERE t."Id"=$1`, [id]))[0]
  }

  /** How `userId` may act on a PENDING task: as the assignee, an active delegate of the assignee, or the assignee's backup. */
  async actingAs(task: { id: number; assigneeUserId: number; documentId: number }, userId: number, docType: string): Promise<ActingAs | null> {
    if (task.assigneeUserId === userId) return 'SELF'
    const [r] = await this.q.query<{ delegate: boolean; backup: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM mst_approval_delegation g WHERE g."FromUserId"=$1 AND g."ToUserId"=$2 AND g."RevokedAt" IS NULL
                        AND now() >= g."StartsAt" AND now() < g."EndsAt" AND (g."DocType" IS NULL OR g."DocType"=$3) AND (g."DocumentId" IS NULL OR g."DocumentId"=$4)) AS delegate,
              EXISTS (SELECT 1 FROM mst_approval_backup b WHERE b."ApproverUserId"=$1 AND b."BackupUserId"=$2 AND b."IsActive" AND NOT b."IsDeleted") AS backup`,
      [task.assigneeUserId, userId, docType, task.documentId])
    return r?.delegate ? 'DELEGATE' : r?.backup ? 'BACKUP' : null
  }

  /** PENDING tasks on a document that `userId` may act on (any capacity). */
  async actableTasks(docId: number, userId: number) {
    return this.q.query<{ publicId: string }>(
      `SELECT t."PublicId" AS "publicId" FROM tr_approval_task t JOIN tr_approval_request r ON r."Id"=t."ApprovalRequestId" JOIN tr_document d ON d."Id"=r."DocumentId"
        WHERE r."DocumentId"=$1 AND t."Status"='PENDING' AND (t."AssigneeUserId"=$2
          OR EXISTS (SELECT 1 FROM mst_approval_delegation g WHERE g."FromUserId"=t."AssigneeUserId" AND g."ToUserId"=$2 AND g."RevokedAt" IS NULL
                     AND now() >= g."StartsAt" AND now() < g."EndsAt" AND (g."DocType" IS NULL OR g."DocType"=d."DocType") AND (g."DocumentId" IS NULL OR g."DocumentId"=d."Id"))
          OR EXISTS (SELECT 1 FROM mst_approval_backup b WHERE b."ApproverUserId"=t."AssigneeUserId" AND b."BackupUserId"=$2 AND b."IsActive" AND NOT b."IsDeleted"))`,
      [docId, userId])
  }

  /** Optimistic decide: only a still-PENDING task at the expected version. */
  async decide(taskId: number, version: number, status: string, actorId: number, actingAs: ActingAs, remarks: string | null) {
    return (await this.q.query(
      `UPDATE tr_approval_task SET "Status"=$3,"ActedByUserId"=$4,"ActingAs"=$5,"ActedAt"=now(),"Remarks"=$6,"Version"="Version"+1
        WHERE "Id"=$1 AND "Version"=$2 AND "Status"='PENDING' RETURNING 1`, [taskId, version, status, actorId, actingAs, remarks])).length > 0
  }
  async approvedInStep(requestId: number, stepNo: number) {
    return (await this.q.query<{ n: number }>(`SELECT count(*)::int AS n FROM tr_approval_task WHERE "ApprovalRequestId"=$1 AND "StepNo"=$2 AND "Status"='APPROVED'`, [requestId, stepNo]))[0]!.n
  }
  skipOpenInStep(requestId: number, stepNo: number) {
    return this.q.query(`UPDATE tr_approval_task SET "Status"='SKIPPED' WHERE "ApprovalRequestId"=$1 AND "StepNo"=$2 AND "Status" IN ('WAITING','PENDING')`, [requestId, stepNo])
  }
  cancelOpenTasks(requestId: number) {
    return this.q.query(`UPDATE tr_approval_task SET "Status"='CANCELLED' WHERE "ApprovalRequestId"=$1 AND "Status" IN ('WAITING','PENDING')`, [requestId])
  }
  /** Activate the next step that still has waiting tasks; returns its assignees (empty = round complete). */
  async activateNextStep(requestId: number) {
    const next = (await this.q.query<{ stepNo: number }>(`SELECT min("StepNo") AS "stepNo" FROM tr_approval_task WHERE "ApprovalRequestId"=$1 AND "Status"='WAITING'`, [requestId]))[0]?.stepNo
    if (next == null) return []
    return this.q.query<{ id: number; assigneeUserId: number }>(
      `UPDATE tr_approval_task SET "Status"='PENDING' WHERE "ApprovalRequestId"=$1 AND "StepNo"=$2 AND "Status"='WAITING' RETURNING "Id" AS id, "AssigneeUserId" AS "assigneeUserId"`, [requestId, next])
  }
  async requiredFor(templateId: number, stepNo: number) {
    return (await this.q.query<{ n: number }>(`SELECT "RequiredApprovals" AS n FROM mst_approval_template_step WHERE "TemplateId"=$1 AND "StepNo"=$2`, [templateId, stepNo]))[0]?.n ?? 1
  }
  async openTasksInStep(requestId: number, stepNo: number) {
    return (await this.q.query<{ n: number }>(`SELECT count(*)::int AS n FROM tr_approval_task WHERE "ApprovalRequestId"=$1 AND "StepNo"=$2 AND "Status"='PENDING'`, [requestId, stepNo]))[0]!.n
  }

  /** Rounds + tasks of a document for the approval panel. */
  async history(docId: number) {
    return this.q.query(
      `SELECT r."RoundNo" AS "roundNo", r."Status" AS "roundStatus", r."StartedAt" AS "startedAt", r."CompletedAt" AS "completedAt", tp."Name" AS "templateName",
              t."PublicId" AS "taskId", t."StepNo" AS "stepNo", s."Name" AS "stepName", t."Status" AS status, au."DisplayName" AS "assigneeName",
              bu."DisplayName" AS "actedByName", t."ActingAs" AS "actingAs", t."ActedAt" AS "actedAt", t."ActorJobTitle" AS "actorJobTitle", t."Remarks" AS remarks
         FROM tr_approval_request r JOIN mst_approval_template tp ON tp."Id"=r."TemplateId"
         JOIN tr_approval_task t ON t."ApprovalRequestId"=r."Id" JOIN mst_user au ON au."Id"=t."AssigneeUserId"
         LEFT JOIN mst_user bu ON bu."Id"=t."ActedByUserId"
         LEFT JOIN mst_approval_template_step s ON s."TemplateId"=r."TemplateId" AND s."StepNo"=t."StepNo"
        WHERE r."DocumentId"=$1 ORDER BY r."RoundNo", t."StepNo", t."Id"`, [docId])
  }

  /** Re-point one open task to another user (reassignment / handover); the new task keeps the old one's WAITING / PENDING state. */
  async replaceTask(oldTaskId: number, toUserId: number, remarks: string) {
    const [old] = await this.q.query<{ requestId: number; stepNo: number; status: 'WAITING' | 'PENDING' }>(
      `SELECT "ApprovalRequestId" AS "requestId", "StepNo" AS "stepNo", "Status" AS status FROM tr_approval_task
        WHERE "Id"=$1 AND "Status" IN ('WAITING','PENDING') FOR UPDATE`, [oldTaskId])
    if (!old) return null
    await this.q.query(`UPDATE tr_approval_task SET "Status"='REASSIGNED',"Remarks"=left($2,1000),"ActedAt"=now() WHERE "Id"=$1`, [oldTaskId, remarks])
    return this.addTask(old.requestId, old.stepNo, toUserId, old.status, oldTaskId)
  }
}

