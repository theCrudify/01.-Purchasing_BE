/**
 * Approval engine — internal API used inside the caller's transaction `q`.
 *  - submitForApproval: pick the template, resolve approvers per step, open a round, move the document to PENDING_APPROVAL.
 *  - decideTask: approve / reject / return as assignee, delegate or backup; finishes steps and rounds; moves the document.
 * The DB guarantees: one open round per document, PENDING_APPROVAL ⇔ open round (checked at commit), one live task per
 * assignee per step, remarks on reject/return, a task is decided once.
 */
import type { Queryable } from '../../core/db'
import { HttpError, notFound } from '../../core/errors'
import { changeStatus, lockDocument, canView, type WfActor } from '../document/document.core'
import { DocumentRepository, type DocRow } from '../document/document.repository'
import { docTypeHooks, type ApprovalOutcome } from '../document/document.registry'
import { NotificationRepository } from '../notification/notification.repository'
import { ApprovalRepository, type StepRow } from './approval.repository'

const rule = (msg: string) => new HttpError(422, 'RULE_VIOLATION', msg)
const label = (d: DocRow) => `${d.docType} ${d.docNo ?? d.title ?? ''}`.trim()

export type Decision = 'APPROVE' | 'REJECT' | 'RETURN'

/** Approver picks (REQUESTER_PICK / PREPARER_MAPPING_PICK steps), by step code → user PublicId. */
export async function savePicks(q: Queryable, actor: WfActor, docId: number, picks: Record<string, string>) {
  const repo = new ApprovalRepository(q)
  const ids = Object.values(picks)
  const users = ids.length ? await repo.userIdsByPublicIds(ids) : []
  const byPub = new Map(users.map((u) => [u.publicId, u.id]))
  const out = Object.entries(picks).map(([stepCode, pub]) => {
    const userId = byPub.get(pub)
    if (!userId) throw rule(`Picked approver for ${stepCode} is not an active internal user`)
    if (userId === actor.id) throw rule('You cannot pick yourself as approver')
    return { stepCode, userId }
  })
  await repo.savePicks(docId, out, actor.id)
}

async function notifyTasks(q: Queryable, d: DocRow, userIds: number[]) {
  const n = new NotificationRepository(q)
  for (const userId of new Set(userIds)) {
    await n.add({ userId, documentId: d.id, eventType: 'APPROVAL_PENDING', title: `Approval needed: ${label(d)}`, body: `${d.title ?? ''} — requested by ${d.ownerName}`.trim() })
  }
}

/**
 * Start (or restart after RETURNED / REVISION_REQUIRED) the approval of a document. `context` lets the module add match
 * criteria (purchase class). Returns the round number. Throws 422 when no template matches or a mandatory step has no approver.
 */
export async function submitForApproval(q: Queryable, actor: WfActor, docId: number, context: { purchaseClassId?: number | null } = {}) {
  const repo = new ApprovalRepository(q)
  const d = await lockDocument(q, docId)
  if (d.isDeleted) throw rule('A deleted document cannot be submitted')
  if (!(await new DocumentRepository(q).transition(d.docType, d.status, 'PENDING_APPROVAL'))) throw rule(`A ${d.status} ${d.docType} cannot be submitted for approval`)
  if (await repo.openRequest(docId)) throw rule('The document already has an open approval round')

  const tpl = await repo.findTemplate(d.docType, d.totalAmountBase, d.departmentId, context.purchaseClassId ?? null, d.docDate)
  if (!tpl) throw rule(`No approval template matches this ${d.docType} (amount, department, purchase class). Ask an administrator to configure one.`)

  const plan: { step: StepRow; users: number[] }[] = []
  for (const step of await repo.steps(tpl.id)) {
    // the requester never approves their own document
    const users = (await repo.resolveStep(step, d)).filter((u) => u !== d.ownerUserId)
    if (!users.length) {
      if (step.isOptional) continue
      throw rule(`No approver found for step ${step.stepNo} "${step.name}"${step.approverType.includes('PICK') ? ' — pick one before submitting' : ''}`)
    }
    if (users.length < step.requiredApprovals) throw rule(`Step "${step.name}" needs ${step.requiredApprovals} approvers but only ${users.length} are available`)
    plan.push({ step, users })
  }
  if (!plan.length) throw rule('The approval template has no usable steps')

  const round = await repo.openRound(docId, tpl.id)
  const first: number[] = []
  for (const [i, { step, users }] of plan.entries()) {
    for (const u of users) await repo.addTask(round.id, step.stepNo, u, i === 0 ? 'PENDING' : 'WAITING')
    if (i === 0) first.push(...users)
  }
  await changeStatus(q, actor, docId, 'PENDING_APPROVAL', { viaApproval: true, remarks: round.roundNo > 1 ? `Resubmitted (round ${round.roundNo})` : 'Submitted' })
  await notifyTasks(q, { ...d, docNo: (await lockDocument(q, docId)).docNo }, first)
  return { roundNo: round.roundNo, template: tpl.code }
}

/** The document an actor may decide on through `taskPublicId` (404 when not actable — no existence leak). */
async function actable(q: Queryable, actor: WfActor, taskPublicId: string) {
  const repo = new ApprovalRepository(q)
  const t = await repo.taskByPublicId(taskPublicId, true)
  if (!t) throw notFound('Approval task')
  const d = await lockDocument(q, t.documentId)
  const as = t.status === 'PENDING' ? await repo.actingAs(t, actor.id, d.docType) : null
  if (!as) {
    if (await canView(q, actor, d)) throw rule(t.status === 'PENDING' ? 'This task is assigned to someone else' : `This task is already ${t.status}`)
    throw notFound('Approval task')
  }
  return { t, d, as }
}

export async function decideTask(q: Queryable, actor: WfActor, taskPublicId: string, decision: Decision, remarks?: string | null) {
  if (actor.userType !== 'INTERNAL') throw rule('Only company staff can decide approvals')
  const repo = new ApprovalRepository(q)
  const { t, d, as } = await actable(q, actor, taskPublicId)
  if (d.ownerUserId === actor.id) throw rule('You cannot approve your own document')
  if (decision !== 'APPROVE' && !remarks?.trim()) throw rule('Remarks are required to reject or return')
  const status = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'RETURNED'
  if (!(await repo.decide(t.id, t.version, status, actor.id, as, remarks?.trim() || null))) throw new HttpError(409, 'CONFLICT', 'The task was decided by someone else just now')

  let outcome: ApprovalOutcome | null = null
  if (status !== 'APPROVED') {
    await repo.cancelOpenTasks(t.requestId)
    outcome = status
  } else if ((await repo.approvedInStep(t.requestId, t.stepNo)) >= (await repo.requiredFor(t.templateId, t.stepNo)) || (await repo.openTasksInStep(t.requestId, t.stepNo)) === 0) {
    await repo.skipOpenInStep(t.requestId, t.stepNo)
    const next = await repo.activateNextStep(t.requestId)
    if (next.length) await notifyTasks(q, d, next.map((x) => x.assigneeUserId))
    else outcome = 'APPROVED'
  }

  if (outcome) await finishRound(q, actor, d, t.requestId, outcome, remarks ?? null)
  return { taskStatus: status, documentStatus: outcome ? (await lockDocument(q, d.id)).status : d.status, outcome }
}

async function finishRound(q: Queryable, actor: WfActor, d: DocRow, requestId: number, outcome: ApprovalOutcome, remarks: string | null) {
  const repo = new ApprovalRepository(q)
  await repo.closeRound(requestId, outcome)
  const to = await new DocumentRepository(q).outcomeStatus(d.docType, outcome)
  if (!to) throw rule(`No status configured for ${d.docType} approval outcome ${outcome}`)
  await changeStatus(q, actor, d.id, to, { viaApproval: true, remarks: remarks ?? `Approval ${outcome.toLowerCase()}` })
  await docTypeHooks(d.docType).onApprovalFinished?.(q, { documentId: d.id, publicId: d.publicId, docType: d.docType, outcome, newStatus: to, roundId: requestId, actor })
  await new NotificationRepository(q).add({
    userId: d.ownerUserId, documentId: d.id, eventType: `APPROVAL_${outcome}`,
    title: `${label(d)} ${outcome === 'APPROVED' ? 'approved' : outcome === 'REJECTED' ? 'rejected' : 'returned for revision'}`,
    body: remarks ?? undefined,
  })
}

/** Owner pulls a pending document back (only where the status matrix allows PENDING_APPROVAL → WITHDRAWN). */
export async function withdraw(q: Queryable, actor: WfActor, docId: number, reason: string) {
  const d = await lockDocument(q, docId)
  if (d.ownerUserId !== actor.id) throw rule('Only the requester can withdraw the document')
  await new ApprovalRepository(q).cancelOpenRound(docId, `Withdrawn: ${reason}`)
  return changeStatus(q, actor, docId, 'WITHDRAWN', { viaApproval: true, remarks: reason })
}
