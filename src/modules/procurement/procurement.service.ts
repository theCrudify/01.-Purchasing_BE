import type { Db } from '../../core/db'
import type { ListQuery } from '../../core/list-query'
import type { Actor } from '../../core/types'
import { submitForApproval } from '../approval/approval.engine'
import { assignNumber, changeStatus, createDraft, loadDocument } from '../document/document.core'
import { DocumentRepository } from '../document/document.repository'
import { ProcurementRepository } from './procurement.repository'
import type { CtrCreate, GrCreate, PoCreate, PrCreate, QuoCreate, RfqCreate } from './procurement.schema'

export class ProcurementService {
  constructor(private db: Db, private actor: Actor) {}

  private async bpScope(q: Parameters<Parameters<Db['session']>[1]>[0]) {
    if (this.actor.userType !== 'BP') return undefined
    return new DocumentRepository(q).bpIdsOfUser(this.actor.id)
  }

  listPr(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new ProcurementRepository(q).listPr(qs))
  }
  listRfq(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new ProcurementRepository(q).listRfq(qs))
  }
  listQuo(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new ProcurementRepository(q).listQuo(qs, await this.bpScope(q)))
  }
  listCtr(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new ProcurementRepository(q).listCtr(qs, await this.bpScope(q)))
  }
  listPo(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new ProcurementRepository(q).listPo(qs, await this.bpScope(q)))
  }
  listGr(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new ProcurementRepository(q).listGr(qs, await this.bpScope(q)))
  }

  prLines(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId)
      return new ProcurementRepository(q).prLines(d.id)
    })
  }

  rfqLines(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId)
      return new ProcurementRepository(q).rfqLines(d.id)
    })
  }

  poLines(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId)
      return new ProcurementRepository(q).poLines(d.id)
    })
  }

  createPr(d: PrCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new ProcurementRepository(q)
      const doc = await createDraft(q, this.actor, 'PR', {
        title: d.title,
        docDate: d.docDate,
        departmentId: d.departmentId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertPr(doc.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createRfq(d: RfqCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new ProcurementRepository(q)
      const doc = await createDraft(q, this.actor, 'RFQ', {
        title: d.title,
        docDate: d.docDate,
        departmentId: d.departmentId ?? null,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertRfq(doc.id, d, this.actor.id)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createQuo(d: QuoCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new ProcurementRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      const doc = await createDraft(q, this.actor, 'QUO', {
        title: d.title,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertQuo(doc.id, bpId, d, this.actor.id)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createCtr(d: CtrCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new ProcurementRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      const doc = await createDraft(q, this.actor, 'CTR', {
        title: d.title,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertCtr(doc.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createPo(d: PoCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new ProcurementRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      const doc = await createDraft(q, this.actor, 'PO', {
        title: d.title,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertPo(doc.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createGr(d: GrCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new ProcurementRepository(q)
      const doc = await createDraft(q, this.actor, 'GR', {
        title: d.title,
        docDate: d.receivedDate,
        currencyCode: 'IDR',
        remarks: d.remarks ?? null,
      })
      await repo.insertGr(doc.id, d, this.actor.id)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  submit(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId, { lock: true })
      const docRepo = new DocumentRepository(q)
      if (await docRepo.transition(d.docType, d.status, 'PENDING_APPROVAL')) {
        return submitForApproval(q, this.actor, d.id)
      }
      // Fallback for doc types whose direct transition is SUBMITTED / PUBLISHED / RECEIVED
      for (const target of ['SUBMITTED', 'PUBLISHED', 'RECEIVED', 'APPROVED']) {
        const t = await docRepo.transition(d.docType, d.status, target)
        if (t && !t.requiredApproval) {
          await changeStatus(q, this.actor, d.id, target, { remarks: 'Submitted' })
          return { status: target }
        }
      }
      return submitForApproval(q, this.actor, d.id)
    })
  }
}
