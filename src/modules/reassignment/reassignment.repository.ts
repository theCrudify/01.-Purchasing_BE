import type { Queryable } from '../../core/db'
import { runList } from '../../core/list-query'
import { reassignmentList, type ReassignmentListQuery } from './reassignment.schema'

/** SQL only. */
export class ReassignmentRepository {
  constructor(private q: Queryable) {}
  list(userId: number, qs: ReassignmentListQuery) {
    const where: string[] = [], params: unknown[] = [userId]
    if (qs.box === 'to-decide') where.push(`t."ApproverUserId"=$1`, `t."Status"='PENDING'`)
    else if (qs.box === 'mine') where.push(`($1 IN (t."FromUserId", t."ToUserId", t."RequestedBy", t."ApproverUserId"))`)
    else where.push(`$1::bigint IS NOT NULL`)
    if (qs.status) { params.push(qs.status); where.push(`t."Status"=$${params.length}`) }
    return runList(this.q, reassignmentList, qs, { where, params })
  }
  async userId(publicId: string) {
    return (await this.q.query<{ id: number }>(`SELECT "Id" AS id FROM mst_user WHERE "PublicId"=$1 AND "UserType"='INTERNAL' AND "Status"='ACTIVE'`, [publicId]))[0]?.id
  }
  /** true when `approver` is a (transitive) superior of `userId` */
  async isSuperior(userId: number, approver: number) {
    return !!(await this.q.query<{ hit: boolean }>(
      `WITH RECURSIVE up AS (SELECT "SuperiorUserId" AS s, 1 AS lvl FROM mst_employee WHERE "UserId"=$1
         UNION ALL SELECT e."SuperiorUserId", up.lvl + 1 FROM mst_employee e JOIN up ON e."UserId"=up.s WHERE up.lvl < 20)
       SELECT EXISTS (SELECT 1 FROM up WHERE s=$2) AS hit`, [userId, approver]))[0]?.hit
  }
  /** Open tasks of a user (optionally limited to given PublicIds). */
  openTasks(userId: number, publicIds?: string[]) {
    return this.q.query<{ id: number }>(
      `SELECT "Id" AS id FROM tr_approval_task WHERE "AssigneeUserId"=$1 AND "Status" IN ('WAITING','PENDING') AND ($2::uuid[] IS NULL OR "PublicId" = ANY($2::uuid[]))`,
      [userId, publicIds ?? null])
  }
  async create(d: { from: number; to: number; approver: number; reason: string; remarks: string; requestedBy: number; handoverId?: number | null }, taskIds: number[]) {
    const [r] = await this.q.query<{ id: number; publicId: string }>(
      `INSERT INTO tr_approval_reassignment ("FromUserId","ToUserId","ApproverUserId","Reason","Remarks","RequestedBy","HandoverId")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "Id" AS id, "PublicId" AS "publicId"`, [d.from, d.to, d.approver, d.reason, d.remarks, d.requestedBy, d.handoverId ?? null])
    for (const t of taskIds) await this.q.query(`INSERT INTO tr_approval_reassignment_item ("ReassignmentId","OldTaskId") VALUES ($1,$2)`, [r!.id, t])
    return r!
  }
  async get(publicId: string, lock = false) {
    return (await this.q.query<{ id: number; status: string; fromUserId: number; toUserId: number; approverUserId: number; remarks: string }>(
      `SELECT "Id" AS id, "Status" AS status, "FromUserId" AS "fromUserId", "ToUserId" AS "toUserId", "ApproverUserId" AS "approverUserId", "Remarks" AS remarks
         FROM tr_approval_reassignment WHERE "PublicId"=$1${lock ? ' FOR UPDATE' : ''}`, [publicId]))[0]
  }
  items(id: number) { return this.q.query<{ id: number; oldTaskId: number }>(`SELECT "Id" AS id, "OldTaskId" AS "oldTaskId" FROM tr_approval_reassignment_item WHERE "ReassignmentId"=$1`, [id]) }
  setNewTask(itemId: number, newTaskId: number) { return this.q.query(`UPDATE tr_approval_reassignment_item SET "NewTaskId"=$2 WHERE "Id"=$1`, [itemId, newTaskId]) }
  decide(id: number, status: string, remarks: string | null) {
    return this.q.query(`UPDATE tr_approval_reassignment SET "Status"=$2,"DecidedAt"=now(),"DecisionRemarks"=$3 WHERE "Id"=$1`, [id, status, remarks])
  }
}
