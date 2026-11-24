import type { Db } from '../../core/db'
import type { ListQuery } from '../../core/list-query'
import type { Actor } from '../../core/types'
import { HttpError, forbidden } from '../../core/errors'
import { submitForApproval } from '../approval/approval.engine'
import { assignNumber, changeStatus, createDraft, loadDocument } from '../document/document.core'
import { DocumentRepository } from '../document/document.repository'
import { ProcurementRepository } from './procurement.repository'
import type { CtrCreate, GrCreate, PoCreate, PrCreate, QuoCreate, RfqCreate } from './procurement.schema'

export class ProcurementService {
  constructor(private db: Db, private actor: Actor) {}

  /** QUO vendor: BP users may only quote as one of their own BPs; internal users must name the vendor. */
  private async quoBpId(q: Parameters<Parameters<Db['session']>[1]>[0], given?: string) {
    const repo = new ProcurementRepository(q)
    if (this.actor.userType === 'BP') {
      const own = (await this.bpScope(q)) ?? []
      const id = given ? await repo.resolveBpId(given) : own[0]
      if (!id || !own.includes(id)) throw forbidden('You can only quote for your own company')
      return id
    }
    if (!given) throw new HttpError(422, 'VALIDATION', 'Vendor / Business Partner is required')
    return repo.resolveBpId(given)
  }

  private async bpScope(q: Parameters<Parameters<Db['session']>[1]>[0]) {
    if (this.actor.userType !== 'BP') return undefined
    return new DocumentRepository(q).bpIdsOfUser(this.actor.id)
  }

  listPr(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new ProcurementRepository(q).listPr(qs))
  }
  listRfq(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new ProcurementRepository(q).listRfq(qs, await this.bpScope(q)))
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
      const bpId = await this.quoBpId(q, d.bpId)
      const doc = await createDraft(q, this.actor, 'QUO', {
        title: d.title,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertQuo(doc.id, bpId, d, this.actor.id, this.actor.userType === 'BP')
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

  updatePr(publicId: string, d: PrCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new ProcurementRepository(q)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DepartmentId"=$3, "CurrencyCode"=$4, "Remarks"=$5, "UpdatedBy"=$6, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.departmentId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'PR')
      await repo.insertPr(curr.id, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateRfq(publicId: string, d: RfqCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new ProcurementRepository(q)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DepartmentId"=$3, "CurrencyCode"=$4, "Remarks"=$5, "UpdatedBy"=$6, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.departmentId ?? null, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'RFQ')
      await repo.insertRfq(curr.id, d, this.actor.id)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateQuo(publicId: string, d: QuoCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new ProcurementRepository(q)
      const bpId = await this.quoBpId(q, d.bpId)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "BpId"=$3, "CurrencyCode"=$4, "Remarks"=$5, "UpdatedBy"=$6, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, bpId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'QUO')
      await repo.insertQuo(curr.id, bpId, d, this.actor.id, this.actor.userType === 'BP')
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateCtr(publicId: string, d: CtrCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new ProcurementRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "BpId"=$3, "CurrencyCode"=$4, "Remarks"=$5, "UpdatedBy"=$6, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, bpId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'CTR')
      await repo.insertCtr(curr.id, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updatePo(publicId: string, d: PoCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new ProcurementRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "BpId"=$3, "CurrencyCode"=$4, "Remarks"=$5, "UpdatedBy"=$6, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, bpId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'PO')
      await repo.insertPo(curr.id, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateGr(publicId: string, d: GrCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new ProcurementRepository(q)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DocDate"=$3, "Remarks"=$4, "UpdatedBy"=$5, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.receivedDate, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'GR')
      await repo.insertGr(curr.id, d, this.actor.id)
      return { id: curr.publicId, docNo: curr.docNo }
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
      for (const target of ['SUBMITTED', 'PUBLISHED', 'RECEIVED', 'POSTED', 'APPROVED']) {
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
