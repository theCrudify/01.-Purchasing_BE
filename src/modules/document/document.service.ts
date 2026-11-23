import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { forbidden, notFound } from '../../core/errors'
import { readFile, saveFile } from '../../core/storage'
import { ApprovalRepository } from '../approval/approval.repository'
import { withdraw } from '../approval/approval.engine'
import { cancelDocument, loadDocument, restoreDocument, softDelete } from './document.core'
import { DocumentRepository } from './document.repository'
import type { ListQuery } from '../../core/list-query'

type Attach = { file: File; category: string; description?: string; visibility: 'SHARED' | 'INTERNAL' }

/**
 * Generic endpoints shared by every document type. Visibility comes from document.core `canView`
 * (BP users: own BP + portal doc types, SHARED attachments / comments only).
 */
export class DocumentService {
  constructor(private db: Db, private actor: Actor) {}
  private get isBp() { return this.actor.userType === 'BP' }
  private run<T>(publicId: string, fn: (q: Parameters<Parameters<Db['session']>[1]>[0], d: Awaited<ReturnType<typeof loadDocument>>, r: DocumentRepository) => Promise<T>, lock = false) {
    return this.db.session(this.actor, async (q) => fn(q, await loadDocument(q, this.actor, publicId, { lock }), new DocumentRepository(q)))
  }

  /** Header + subtype detail + lines + status history + approvals + what the caller may do. */
  get(publicId: string) {
    return this.run(publicId, async (q, d, r) => {
      const actable = this.isBp ? [] : await new ApprovalRepository(q).actableTasks(d.id, this.actor.id)
      const { id: _i, bpId: _b, ownerUserId, createdBy: _c, ...header } = d
      const [detail, lines, history, approvals] = await Promise.all([
        r.subtypeDetail(d.id, d.docType),
        r.subtypeLines(d.id, d.docType),
        r.history(d.id),
        this.isBp ? Promise.resolve([]) : new ApprovalRepository(q).history(d.id),
      ])
      return {
        ...header,
        id: d.publicId,
        isOwner: ownerUserId === this.actor.id,
        detail,
        lines,
        history,
        approvals,
        actableTaskIds: actable.map((t) => t.publicId),
      }
    })
  }

  attachments(publicId: string) { return this.run(publicId, (_q, d, r) => r.listAttachments(d.id, this.isBp)) }
  addAttachment(publicId: string, a: Attach) {
    if (this.isBp && a.visibility === 'INTERNAL') a.visibility = 'SHARED' // vendors can only share
    return this.run(publicId, async (q, d, r) => {
      if (d.isDeleted) throw forbidden('The document is deleted')
      const f = await saveFile(q, this.actor.id, a.file)
      return r.addAttachment(d.id, f.id, a, this.actor.id)
    })
  }
  download(publicId: string, attId: string) {
    return this.run(publicId, async (q, d, r) => {
      const a = await r.attachment(d.id, attId)
      if (!a || (this.isBp && a.visibility !== 'SHARED')) throw notFound('Attachment')
      const f = await readFile(q, a.fileId)
      if (!f) throw notFound('Attachment')
      await r.accessLog(this.actor.id, 'DOWNLOAD_FILE', 'tr_document_attachment', attId, f.name)
      return f
    })
  }
  removeAttachment(publicId: string, attId: string) {
    return this.run(publicId, async (_q, d, r) => {
      const a = await r.attachment(d.id, attId)
      if (!a || (this.isBp && a.visibility !== 'SHARED')) throw notFound('Attachment')
      if (a.createdBy !== this.actor.id && !this.actor.permissions.has('DOC.DELETE')) throw forbidden('Only the uploader can remove this attachment')
      await r.removeAttachment(a.id, this.actor.id)
    })
  }

  comments(publicId: string) { return this.run(publicId, (_q, d, r) => r.listComments(d.id, this.isBp)) }
  addComment(publicId: string, body: string, visibility?: 'SHARED' | 'INTERNAL') {
    return this.run(publicId, (_q, d, r) => r.addComment(d.id, body, this.isBp ? 'SHARED' : (visibility ?? 'INTERNAL'), this.actor.id))
  }

  /** Owner (or a <DocType>.MANAGE holder) cancels; open approval rounds are closed first. */
  cancel(publicId: string, reason: string) {
    return this.run(publicId, async (q, d) => {
      if (d.ownerUserId !== this.actor.id && !this.actor.permissions.has(`${d.docType}.MANAGE`)) throw forbidden('Only the owner can cancel this document')
      await cancelDocument(q, this.actor, d.id, reason)
    }, true)
  }
  withdraw(publicId: string, reason: string) { return this.run(publicId, (q, d) => withdraw(q, this.actor, d.id, reason).then(() => undefined), true) }
  remove(publicId: string, reason: string) { return this.run(publicId, (q, d) => softDelete(q, this.actor, d.id, reason), true) }
  restore(publicId: string) { return this.run(publicId, (q, d) => restoreDocument(q, this.actor, d.id), true) }

  deleted(qs: ListQuery & { docType?: string }) {
    if (!this.actor.permissions.has('DOC.VIEW_DELETED')) throw forbidden('Requires DOC.VIEW_DELETED')
    return this.db.session(this.actor, (q) => new DocumentRepository(q).listDeleted(qs))
  }
}
