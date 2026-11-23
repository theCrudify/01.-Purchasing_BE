import type { Db } from '../../core/db'
import type { ListQuery } from '../../core/list-query'
import type { Actor } from '../../core/types'
import { submitForApproval } from '../approval/approval.engine'
import { assignNumber, changeStatus, createDraft, loadDocument } from '../document/document.core'
import { DocumentRepository } from '../document/document.repository'
import { FinanceRepository } from './finance.repository'
import type { AriCreate, CaCreate, InvCreate, PayCreate, RmbCreate, StlCreate } from './finance.schema'

export class FinanceService {
  constructor(private db: Db, private actor: Actor) {}

  private async bpScope(q: Parameters<Parameters<Db['session']>[1]>[0]) {
    if (this.actor.userType !== 'BP') return undefined
    return new DocumentRepository(q).bpIdsOfUser(this.actor.id)
  }

  listCoas() {
    return this.db.session(this.actor, async (q) => ({ data: await new FinanceRepository(q).listCoas() }))
  }
  listTransactionTypes(module?: string) {
    return this.db.session(this.actor, async (q) => ({
      data: await new FinanceRepository(q).listTransactionTypes(module),
    }))
  }
  listCompanyBanks() {
    return this.db.session(this.actor, async (q) => ({ data: await new FinanceRepository(q).listCompanyBanks() }))
  }
  listExpenseCategories() {
    return this.db.session(this.actor, async (q) => ({ data: await new FinanceRepository(q).listExpenseCategories() }))
  }

  listCa(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new FinanceRepository(q).listCa(qs))
  }
  listStl(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new FinanceRepository(q).listStl(qs))
  }
  listRmb(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new FinanceRepository(q).listRmb(qs))
  }
  listInv(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new FinanceRepository(q).listInv(qs, await this.bpScope(q)))
  }
  listPay(qs: ListQuery & { status?: string; purpose?: string }) {
    return this.db.session(this.actor, async (q) => new FinanceRepository(q).listPay(qs, await this.bpScope(q)))
  }
  listAri(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, async (q) => new FinanceRepository(q).listAri(qs, await this.bpScope(q)))
  }

  expenseLines(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId)
      return new FinanceRepository(q).expenseLines(d.id)
    })
  }
  invLines(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId)
      return new FinanceRepository(q).invLines(d.id)
    })
  }
  ariLines(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId)
      return new FinanceRepository(q).ariLines(d.id)
    })
  }

  createCa(d: CaCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new FinanceRepository(q)
      const doc = await createDraft(q, this.actor, 'CA', {
        title: d.title,
        departmentId: d.departmentId ?? null,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertCa(doc.id, this.actor.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createStl(d: StlCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new FinanceRepository(q)
      const doc = await createDraft(q, this.actor, 'STL', {
        title: d.title,
        currencyCode: 'IDR',
        remarks: d.remarks ?? null,
      })
      await repo.insertStl(doc.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createRmb(d: RmbCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new FinanceRepository(q)
      const bpId = d.bpId ? await repo.resolveBpId(d.bpId) : null
      const doc = await createDraft(q, this.actor, 'RMB', {
        title: d.title,
        departmentId: d.departmentId ?? null,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertRmb(doc.id, this.actor.id, bpId, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createInv(d: InvCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new FinanceRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      const doc = await createDraft(q, this.actor, 'INV', {
        title: d.title,
        docDate: d.invoiceDate,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertInv(doc.id, bpId, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createPay(d: PayCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new FinanceRepository(q)
      const doc = await createDraft(q, this.actor, 'PAY', {
        title: d.title,
        docDate: d.plannedDate,
        currencyCode: 'IDR',
        remarks: d.remarks ?? null,
      })
      await repo.insertPay(doc.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  createAri(d: AriCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new FinanceRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      const doc = await createDraft(q, this.actor, 'ARI', {
        title: d.title,
        docDate: d.invoiceDate,
        bpId,
        currencyCode: d.currencyCode,
        remarks: d.remarks ?? null,
      })
      await repo.insertAri(doc.id, d)
      const docNo = await assignNumber(q, this.actor, doc.id)
      return { id: doc.publicId, docNo }
    })
  }

  updateCa(publicId: string, d: CaCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new FinanceRepository(q)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DepartmentId"=$3, "CurrencyCode"=$4, "Remarks"=$5, "UpdatedBy"=$6, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.departmentId ?? null, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'CA')
      await repo.insertCa(curr.id, this.actor.id, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateStl(publicId: string, d: StlCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new FinanceRepository(q)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "Remarks"=$3, "UpdatedBy"=$4, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'STL')
      await repo.insertStl(curr.id, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateRmb(publicId: string, d: RmbCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new FinanceRepository(q)
      const bpId = d.bpId ? await repo.resolveBpId(d.bpId) : null
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DepartmentId"=$3, "BpId"=$4, "CurrencyCode"=$5, "Remarks"=$6, "UpdatedBy"=$7, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.departmentId ?? null, bpId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'RMB')
      await repo.insertRmb(curr.id, this.actor.id, bpId, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateInv(publicId: string, d: InvCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new FinanceRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DocDate"=$3, "BpId"=$4, "CurrencyCode"=$5, "Remarks"=$6, "UpdatedBy"=$7, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.invoiceDate, bpId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'INV')
      await repo.insertInv(curr.id, bpId, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updatePay(publicId: string, d: PayCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new FinanceRepository(q)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DocDate"=$3, "Remarks"=$4, "UpdatedBy"=$5, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.plannedDate, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'PAY')
      await repo.insertPay(curr.id, d)
      return { id: curr.publicId, docNo: curr.docNo }
    })
  }

  updateAri(publicId: string, d: AriCreate) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      const repo = new FinanceRepository(q)
      const bpId = await repo.resolveBpId(d.bpId)
      await q.query(
        `UPDATE tr_document SET "Title"=$2, "DocDate"=$3, "BpId"=$4, "CurrencyCode"=$5, "Remarks"=$6, "UpdatedBy"=$7, "Version"="Version"+1 WHERE "Id"=$1`,
        [curr.id, d.title, d.invoiceDate, bpId, d.currencyCode, d.remarks ?? null, this.actor.id]
      )
      await repo.clearSubtypeForUpdate(curr.id, 'ARI')
      await repo.insertAri(curr.id, d)
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
      for (const target of ['SUBMITTED', 'POSTED', 'APPROVED']) {
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
