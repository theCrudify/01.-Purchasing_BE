import type { Db, Queryable } from '../../core/db'
import type { Actor } from '../../core/types'
import { forbidden, notFound } from '../../core/errors'
import { rule } from '../_master/shared'
import { ApprovalRepository } from '../approval/approval.repository'
import { NotificationRepository } from '../notification/notification.repository'
import { ReassignmentRepository } from './reassignment.repository'
import type { ReassignmentCreate, ReassignmentListQuery } from './reassignment.schema'

/**
 * Move open approval tasks from one user to another, approved by a superior of the current holder
 * (README "Pindah tugas"): request → chosen superior APPROVES (tasks REASSIGNED + new tasks) or REJECTS.
 */
export async function requestReassignment(q: Queryable, actor: Actor, d: { from: number; to: number; approver: number; reason: string; remarks: string; taskPublicIds?: string[]; handoverId?: number | null }) {
  const r = new ReassignmentRepository(q)
  if (d.from === d.to) throw rule('From and to must be different users')
  if ([d.from, d.to, actor.id].includes(d.approver)) throw rule('The approver must be someone else than the requester, the current and the new holder')
  if (!(await r.isSuperior(d.from, d.approver))) throw rule('The approver must be a superior of the current task holder')
  const tasks = await r.openTasks(d.from, d.taskPublicIds)
  if (!tasks.length) throw rule('There are no open approval tasks to move')
  if (d.taskPublicIds && tasks.length !== d.taskPublicIds.length) throw rule('Some tasks are not open tasks of this user')
  const created = await r.create({ ...d, requestedBy: actor.id }, tasks.map((t) => t.id))
  await new NotificationRepository(q).add({ userId: d.approver, eventType: 'REASSIGN_PENDING', title: 'Approval reassignment needs your decision', body: d.remarks })
  return { id: created.publicId, tasks: tasks.length }
}

export class ReassignmentService {
  constructor(private db: Db, private actor: Actor) {}
  private run<T>(fn: (q: Queryable, r: ReassignmentRepository) => Promise<T>) { return this.db.session(this.actor, (q) => fn(q, new ReassignmentRepository(q))) }

  list(qs: ReassignmentListQuery) {
    if (qs.box === 'all' && !this.actor.permissions.has('APPROVAL.REASSIGN')) throw forbidden('Requires APPROVAL.REASSIGN')
    return this.run((_q, r) => r.list(this.actor.id, qs))
  }

  create(d: ReassignmentCreate) {
    return this.run(async (q, r) => {
      const [from, to, approver] = [await r.userId(d.fromId), await r.userId(d.toId), await r.userId(d.approverId)]
      if (!from || !to || !approver) throw rule('From, to and approver must be active internal users')
      if (from !== this.actor.id && !this.actor.permissions.has('APPROVAL.REASSIGN')) throw forbidden('You can only move your own tasks')
      return requestReassignment(q, this.actor, { from, to, approver, reason: d.reason, remarks: d.remarks, taskPublicIds: d.taskIds })
    })
  }

  decide(publicId: string, decision: 'APPROVE' | 'REJECT', remarks?: string) {
    return this.run(async (q, r) => {
      const ra = await r.get(publicId, true)
      if (!ra) throw notFound('Reassignment')
      if (ra.approverUserId !== this.actor.id) throw forbidden('Only the chosen superior can decide')
      if (ra.status !== 'PENDING') throw rule(`The request is already ${ra.status}`)
      if (decision === 'REJECT') {
        if (!remarks?.trim()) throw rule('Remarks are required to reject')
        await r.decide(ra.id, 'REJECTED', remarks.trim())
        return { status: 'REJECTED', moved: 0 }
      }
      const approvals = new ApprovalRepository(q)
      let moved = 0
      for (const it of await r.items(ra.id)) {
        const nt = await approvals.replaceTask(it.oldTaskId, ra.toUserId, `Reassigned: ${ra.remarks}`)
        if (nt) { await r.setNewTask(it.id, nt); moved++ } // tasks decided meanwhile are skipped
      }
      await r.decide(ra.id, 'APPROVED', remarks?.trim() || null)
      if (moved) await new NotificationRepository(q).add({ userId: ra.toUserId, eventType: 'APPROVAL_PENDING', title: `${moved} approval task(s) were reassigned to you` })
      return { status: 'APPROVED', moved }
    })
  }
}
