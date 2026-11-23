/**
 * Document core — internal API for document modules (PR, PO, INV, …). Every function takes the caller's transaction
 * `q` (from `db.session(actor, q => …)`) so the module's subtype rows and the core changes commit or roll back together.
 * See docs/WORKFLOW_API.md.
 */
import type { Queryable } from '../../core/db'
import { HttpError, conflict, forbidden, notFound } from '../../core/errors'
import { ApprovalRepository } from '../approval/approval.repository'
import { DocumentRepository, type DocRow, type HeaderInput, type WfActor } from './document.repository'
import { docTypeHooks } from './document.registry'
import { DELETABLE_STATUSES, EDITABLE_STATUSES, PORTAL_DOC_TYPES } from './document.schema'

export type { DocRow, HeaderInput, WfActor }
const rule = (msg: string) => new HttpError(422, 'RULE_VIOLATION', msg)
const has = (a: WfActor, p: string) => !!a.permissions?.has(p)

/** {PREFIX} {SEQ:n} {SEQ} {YYYY} {YY} {MM}; docDate is 'YYYY-MM-DD'. A number longer than n is never truncated. */
export function formatDocNo(format: string, prefix: string, n: number, docDate: string) {
  const [y = '', m = ''] = docDate.split('-')
  return format
    .replace(/\{SEQ:(\d)\}/g, (_, l: string) => String(n).padStart(Number(l), '0'))
    .replaceAll('{SEQ}', String(n)).replaceAll('{YYYY}', y).replaceAll('{YY}', y.slice(2)).replaceAll('{MM}', m)
    .replaceAll('{PREFIX}', prefix)
}

/** Insert a DRAFT tr_document (owner defaults to the actor). The caller then inserts its subtype row with the returned id. */
export async function createDraft(q: Queryable, actor: WfActor, docType: string, header: HeaderInput = {}) {
  return new DocumentRepository(q).insert(docType, header, actor.id)
}

/** Load + row-lock a document by internal id (inside the caller's transaction). */
export async function lockDocument(q: Queryable, id: number) {
  const d = await new DocumentRepository(q).byId(id, true)
  if (!d) throw notFound('Document')
  return d
}

/** Update header fields with optimistic concurrency. Returns the new Version. 409 when someone else saved first, 422 when locked. */
export async function updateHeader(q: Queryable, actor: WfActor, id: number, version: number, header: HeaderInput) {
  const repo = new DocumentRepository(q)
  const v = await repo.updateHeader(id, version, header, actor.id)
  if (v !== undefined) return v
  const d = await repo.byId(id)
  if (!d) throw notFound('Document')
  if (d.isDeleted) throw rule('A deleted document cannot be changed. Restore it first.')
  if (!EDITABLE_STATUSES.has(d.status)) throw rule(`The document is ${d.status}: it can no longer be edited.`)
  throw conflict('The document was changed by someone else. Reload and try again.')
}

/** Give the document its number if it has none yet (row-locked series, inside the caller's transaction). */
export async function assignNumber(q: Queryable, actor: WfActor, id: number) {
  const repo = new DocumentRepository(q)
  const d = await lockDocument(q, id)
  if (d.docNo) return d.docNo
  const series = docTypeHooks(d.docType).seriesCode ?? d.docType
  const s = await repo.nextNumber(series, d.docDate)
  if (!s) throw rule(`Unknown number series ${series}.`)
  if (actor.userType === 'BP' && !s.allowPortal) throw rule('This number series is not available to portal users.')
  const no = formatDocNo(s.format, s.prefix, s.n, d.docDate)
  await repo.setDocNo(id, no)
  return no
}

/**
 * Move the status along mst_status_transition. `remarks` goes to hist_document_status (via kpin.remarks).
 * Leaving DRAFT assigns the number. Approval-bound moves (PENDING_APPROVAL in / out) must go through the approval engine.
 */
export async function changeStatus(q: Queryable, actor: WfActor, id: number, to: string, opts: { remarks?: string; cancelReason?: string; viaApproval?: boolean } = {}) {
  const repo = new DocumentRepository(q)
  const d = await lockDocument(q, id)
  if (d.isDeleted) throw rule('A deleted document cannot be changed. Restore it first.')
  if (d.status === to) return d
  const t = await repo.transition(d.docType, d.status, to)
  if (!t) throw rule(`Status change ${d.status} → ${to} is not allowed for ${d.docType}.`)
  if (actor.userType === 'BP' && !t.allowBp) throw forbidden('This status change is made by company staff.')
  if (t.requiredApproval && !opts.viaApproval) throw rule('This status change follows the approval: use the approval engine.')
  if (t.requiredApproval && (await repo.latestRoundStatus(id)) !== t.requiredApproval) throw rule('Status does not match the approval round.')
  if (d.status === 'DRAFT' && !d.docNo) await assignNumber(q, actor, id)
  if (to === 'CANCELLED' && !opts.cancelReason) throw rule('A cancel reason is required.')
  await repo.setRemarks(opts.remarks ?? opts.cancelReason ?? '')
  await repo.setStatus(id, to, actor.id, { cancelReason: opts.cancelReason })
  await repo.setRemarks('')
  return { ...d, status: to }
}

/** Cancel: closes an open approval round first, then moves to CANCELLED with the reason. */
export async function cancelDocument(q: Queryable, actor: WfActor, id: number, reason: string) {
  await new ApprovalRepository(q).cancelOpenRound(id, `Cancelled: ${reason}`)
  return changeStatus(q, actor, id, 'CANCELLED', { cancelReason: reason, viaApproval: true })
}

/** Soft delete: only in DRAFT/CANCELLED/REJECTED/WITHDRAWN/SUPERSEDED/NOT_AWARDED; the owner may delete their own draft, else DOC.DELETE. */
export async function softDelete(q: Queryable, actor: WfActor, id: number, reason: string) {
  const d = await lockDocument(q, id)
  if (d.isDeleted) throw rule('The document is already deleted.')
  if (!reason?.trim()) throw rule('A delete reason is required.')
  if (!DELETABLE_STATUSES.has(d.status)) throw rule(`A ${d.status} document cannot be deleted.`)
  if (!(d.status === 'DRAFT' && d.ownerUserId === actor.id) && !has(actor, 'DOC.DELETE')) throw forbidden('Only the owner (own draft) or DOC.DELETE may delete this document.')
  await new DocumentRepository(q).setDeleted(id, true, actor.id, reason.trim())
}

export async function restoreDocument(q: Queryable, actor: WfActor, id: number) {
  if (!has(actor, 'DOC.DELETE')) throw forbidden('Requires DOC.DELETE')
  const d = await lockDocument(q, id)
  if (!d.isDeleted) throw rule('The document is not deleted.')
  await new DocumentRepository(q).setDeleted(id, false, actor.id)
}

/**
 * Visibility used by the generic endpoints (and available to modules):
 * BP → document of one of their BPs, portal-visible type, not deleted. INTERNAL → owner / creator, approval participant,
 * DOC.VIEW_ALL or any `<DocType>.*` permission, or the DocType's `canView` hook; deleted ones need DOC.VIEW_DELETED.
 * Unknown or not visible → 404 (no existence leak).
 */
export async function canView(q: Queryable, actor: WfActor, d: DocRow) {
  const repo = new DocumentRepository(q)
  if (actor.userType === 'BP') return !d.isDeleted && d.bpId != null && PORTAL_DOC_TYPES.has(d.docType) && (await repo.bpIdsOfUser(actor.id)).includes(d.bpId)
  if (actor.userType !== 'INTERNAL') return true // SYSTEM jobs
  if (d.isDeleted && !has(actor, 'DOC.VIEW_DELETED')) return false
  if (d.ownerUserId === actor.id || d.createdBy === actor.id || has(actor, 'DOC.VIEW_ALL')) return true
  if ([...(actor.permissions ?? [])].some((p) => p.startsWith(`${d.docType}.`))) return true
  if (await repo.isParticipant(d.id, actor.id)) return true
  if ((await new ApprovalRepository(q).actableTasks(d.id, actor.id)).length) return true
  return (await docTypeHooks(d.docType).canView?.(q, actor, d)) ?? false
}

export async function loadDocument(q: Queryable, actor: WfActor, publicId: string, opts: { lock?: boolean } = {}) {
  const d = await new DocumentRepository(q).byPublicId(publicId, opts.lock)
  if (!d || !(await canView(q, actor, d))) throw notFound('Document')
  return d
}
