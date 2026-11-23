import type { Queryable } from '../../core/db'
import type { DocRow, WfActor } from './document.repository'

export type ApprovalOutcome = 'APPROVED' | 'REJECTED' | 'RETURNED'
export type ApprovalFinishedEvent = { documentId: number; publicId: string; docType: string; outcome: ApprovalOutcome; newStatus: string; roundId: number; actor: WfActor }

export type DocTypeHooks = {
  /** Web path of the document page, used in notification links (default: /approvals). */
  path?: (publicId: string) => string
  /** Number series code (default: the DocType). */
  seriesCode?: string
  /** Extra visibility rule for INTERNAL users on the generic endpoints; return true to allow. */
  canView?: (q: Queryable, actor: WfActor, doc: DocRow) => Promise<boolean>
  /** Runs inside the deciding transaction after the document status has moved; throw to roll everything back. */
  onApprovalFinished?: (q: Queryable, e: ApprovalFinishedEvent) => Promise<void>
}

const hooks = new Map<string, DocTypeHooks>()

/** Register per-DocType behaviour (call once at module load, e.g. top of <m>.service.ts). Merges with earlier calls. */
export function registerDocType(docType: string, h: DocTypeHooks) { hooks.set(docType, { ...hooks.get(docType), ...h }) }
export const onApprovalFinished = (docType: string, handler: NonNullable<DocTypeHooks['onApprovalFinished']>) => registerDocType(docType, { onApprovalFinished: handler })
export const docTypeHooks = (docType: string): DocTypeHooks => hooks.get(docType) ?? {}
