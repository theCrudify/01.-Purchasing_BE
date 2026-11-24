import type { Db } from '../../core/db'
import { HttpError } from '../../core/errors'
import type { ListQuery } from '../../core/list-query'
import type { Actor } from '../../core/types'
import { submitForApproval } from '../approval/approval.engine'
import { assignNumber, changeStatus, createDraft, loadDocument } from '../document/document.core'
import { DocumentRepository } from '../document/document.repository'
import { FinanceRepository } from './finance.repository'
import type { AriCreate, CaCreate, InvCreate, PayCreate, PayInstallments, PayMufgAction, RmbCreate, StlCreate } from './finance.schema'

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

  private async applyCompletedAllocations(q: Parameters<Parameters<Db['session']>[1]>[0], payDocId: number) {
    const allocs = await q.query<{ targetId: number }>(
      `SELECT "TargetDocumentId" AS "targetId" FROM tr_payment_allocation WHERE "PaymentId"=$1`,
      [payDocId]
    )
    for (const a of allocs) {
      const [sumRow] = await q.query<{ applied: string }>(
        `SELECT COALESCE(SUM(pa."AmountApplied"), 0) AS applied
           FROM tr_payment_allocation pa
           JOIN tr_document pd ON pd."Id" = pa."PaymentId"
          WHERE pa."TargetDocumentId"=$1 AND NOT pd."IsDeleted" AND pd."Status" IN ('POSTED','COMPLETED')`,
        [a.targetId]
      )
      const [tgt] = await q.query<{ docType: string; status: string; totalAmount: string }>(
        `SELECT "DocType" AS "docType", "Status" AS status, COALESCE("TotalAmount", 0) AS "totalAmount"
           FROM tr_document WHERE "Id"=$1`,
        [a.targetId]
      )
      if (!tgt) continue
      const applied = Number(sumRow?.applied ?? 0)
      const total = Number(tgt.totalAmount ?? 0)
      await q.query(`UPDATE tr_document SET "AppliedAmount"=$2 WHERE "Id"=$1`, [a.targetId, applied.toFixed(2)])

      if (tgt.docType === 'INV' || tgt.docType === 'RMB') {
        const nextStatus = applied >= total && total > 0 ? 'PAID' : applied > 0 ? 'PARTIALLY_PAID' : null
        if (nextStatus && tgt.status !== nextStatus) {
          if (tgt.status === 'APPROVED') {
            await changeStatus(q, this.actor, a.targetId, 'PAYMENT_PROCESSING', { remarks: 'MUFG payment initiated' })
          }
          await changeStatus(q, this.actor, a.targetId, nextStatus, { remarks: `MUFG payment ${nextStatus.toLowerCase()}` })
        }
      } else if (tgt.docType === 'CA' && applied > 0 && tgt.status !== 'DISBURSED') {
        if (tgt.status === 'APPROVED') {
          await changeStatus(q, this.actor, a.targetId, 'PAYMENT_PROCESSING', { remarks: 'MUFG disbursement initiated' })
        }
        await changeStatus(q, this.actor, a.targetId, 'DISBURSED', { remarks: 'MUFG cash advance disbursed' })
      }
    }
  }

  private async runMufgOnPayment(
    q: Parameters<Parameters<Db['session']>[1]>[0],
    payDocId: number,
    currentStatus: string,
    mode: PayMufgAction['mode'],
    reason?: string
  ) {
    const tag = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(payDocId).padStart(4, '0')}`
    const batchNo = `MUFG-BATCH-${tag}`
    const bankRef = `MUFG-TRF-${tag}-${Math.floor(1000 + Math.random() * 9000)}`

    if (mode === 'SEND') {
      if (!['APPROVED', 'FAILED'].includes(currentStatus)) {
        throw new HttpError(422, 'RULE_VIOLATION', `Payment status ${currentStatus} cannot be sent to MUFG`)
      }
      await changeStatus(q, this.actor, payDocId, 'SENT_TO_BANK', { remarks: 'Mock MUFG: Sent to bank gateway' })
      await q.query(`UPDATE tr_payment SET "BankBatchNo"=$2, "FailureReason"=NULL WHERE "DocumentId"=$1`, [payDocId, batchNo])
      return { status: 'SENT_TO_BANK', bankBatchNo: batchNo }
    }

    if (mode === 'FAIL') {
      if (!['SENT_TO_BANK', 'POSTED'].includes(currentStatus)) {
        throw new HttpError(422, 'RULE_VIOLATION', `Payment status ${currentStatus} cannot fail bank callback`)
      }
      const msg = reason || 'Mock MUFG: Rejected by clearing (insufficient limit / invalid beneficiary)'
      await changeStatus(q, this.actor, payDocId, 'FAILED', { remarks: msg })
      await q.query(`UPDATE tr_payment SET "FailureReason"=$2 WHERE "DocumentId"=$1`, [payDocId, msg])
      return { status: 'FAILED', failureReason: msg }
    }

    // AUTO or COMPLETE
    if (mode === 'AUTO') {
      if (!['APPROVED', 'FAILED'].includes(currentStatus)) {
        throw new HttpError(422, 'RULE_VIOLATION', `Payment must be APPROVED or FAILED for MUFG Auto-Pay (current: ${currentStatus})`)
      }
      await changeStatus(q, this.actor, payDocId, 'SENT_TO_BANK', { remarks: 'Mock MUFG Auto-Pay: Dispatched' })
    } else if (currentStatus !== 'SENT_TO_BANK') {
      throw new HttpError(422, 'RULE_VIOLATION', `Payment must be SENT_TO_BANK to complete (current: ${currentStatus})`)
    }

    await changeStatus(q, this.actor, payDocId, 'POSTED', { remarks: `Mock MUFG: Bank accepted (${bankRef})` })
    await changeStatus(q, this.actor, payDocId, 'COMPLETED', { remarks: `Mock MUFG: Funds transferred (${bankRef})` })
    await q.query(
      `UPDATE tr_payment SET "BankBatchNo"=COALESCE("BankBatchNo",$2), "BankReference"=$3, "PostedAt"=now(), "PaidDate"=CURRENT_DATE, "FailureReason"=NULL WHERE "DocumentId"=$1`,
      [payDocId, batchNo, bankRef]
    )
    await this.applyCompletedAllocations(q, payDocId)
    return { status: 'COMPLETED', bankBatchNo: batchNo, bankReference: bankRef }
  }

  mufgAction(publicId: string, d: PayMufgAction) {
    return this.db.session(this.actor, async (q) => {
      const curr = await loadDocument(q, this.actor, publicId, { lock: true })
      if (curr.docType !== 'PAY') throw new HttpError(422, 'RULE_VIOLATION', 'Only Payment documents support MUFG actions')
      return this.runMufgOnPayment(q, curr.id, curr.status, d.mode, d.reason)
    })
  }

  createInstallments(d: PayInstallments) {
    return this.db.session(this.actor, async (q) => {
      const [tgt] = await q.query<{
        id: number
        publicId: string
        docType: string
        docNo: string | null
        status: string
        bpId: number | null
        currencyCode: string | null
        totalAmount: string | null
        appliedAmount: string | null
      }>(
        `SELECT "Id" AS id, "PublicId" AS "publicId", "DocType" AS "docType", "DocNo" AS "docNo", "Status" AS status,
                "BpId" AS "bpId", "CurrencyCode" AS "currencyCode", "TotalAmount" AS "totalAmount", "AppliedAmount" AS "appliedAmount"
           FROM tr_document WHERE "PublicId"=$1 AND NOT "IsDeleted" FOR UPDATE`,
        [d.targetDocId]
      )
      if (!tgt) throw new HttpError(404, 'NOT_FOUND', 'Target document not found')
      const purpose =
        tgt.docType === 'INV'
          ? 'AP_INVOICE'
          : tgt.docType === 'CA'
            ? 'CASH_ADVANCE'
            : tgt.docType === 'RMB'
              ? 'REIMBURSEMENT'
              : null
      if (!purpose) throw new HttpError(422, 'RULE_VIOLATION', 'Target must be an AP Invoice, Cash Advance, or Reimbursement')

      const [sumRow] = await q.query<{ applied: string }>(
        `SELECT COALESCE(SUM(pa."AmountApplied"), 0) AS applied
           FROM tr_payment_allocation pa
           JOIN tr_document pd ON pd."Id" = pa."PaymentId"
          WHERE pa."TargetDocumentId"=$1 AND NOT pd."IsDeleted" AND pd."Status" IN ('POSTED','COMPLETED')`,
        [tgt.id]
      )
      const total = Number(tgt.totalAmount ?? 0)
      const applied = Math.max(Number(tgt.appliedAmount ?? 0), Number(sumRow?.applied ?? 0))
      const remaining = Math.max(0, total - applied)
      if (remaining <= 0) throw new HttpError(422, 'RULE_VIOLATION', 'Document is already fully paid')

      const totalPct = d.schedule.reduce((acc, s) => acc + s.percent, 0)
      if (totalPct > 100.01) throw new HttpError(422, 'RULE_VIOLATION', 'Total installment percentage cannot exceed 100%')

      const repo = new FinanceRepository(q)
      const created: { id: string; docNo: string; label: string; amount: number; status: string }[] = []
      let allocated = 0

      for (const [idx, stage] of d.schedule.entries()) {
        const isLastFull = idx === d.schedule.length - 1 && Math.abs(totalPct - 100) < 0.01
        const amt = isLastFull ? Number((remaining - allocated).toFixed(2)) : Number(((remaining * stage.percent) / 100).toFixed(2))
        allocated += amt
        if (amt <= 0) continue

        const doc = await createDraft(q, this.actor, 'PAY', {
          title: `${stage.label} (${stage.percent}%) — ${tgt.docNo ?? tgt.docType}`,
          docDate: stage.plannedDate,
          bpId: tgt.bpId,
          currencyCode: tgt.currencyCode ?? 'IDR',
          remarks: `Pembayaran bertahap sesuai perjanjian: ${stage.label} (${stage.percent}% dari sisa tagihan)`,
        })
        await repo.insertPay(doc.id, {
          title: `${stage.label} (${stage.percent}%) — ${tgt.docNo ?? tgt.docType}`,
          purpose,
          targetDocId: d.targetDocId,
          companyBankAccountId: d.companyBankAccountId,
          paymentMethod: d.paymentMethod,
          plannedDate: stage.plannedDate,
          amountApplied: amt,
          bankReference: null,
          remarks: stage.label,
        })
        const docNo = await assignNumber(q, this.actor, doc.id)
        await changeStatus(q, this.actor, doc.id, 'APPROVED', { remarks: 'Auto-approved per agreement installment schedule' })

        let finalStatus = 'APPROVED'
        if (d.autoPayFirst && idx === 0) {
          const res = await this.runMufgOnPayment(q, doc.id, 'APPROVED', 'AUTO')
          finalStatus = res.status
        }

        created.push({ id: doc.publicId, docNo, label: stage.label, amount: amt, status: finalStatus })
      }

      return { targetDocNo: tgt.docNo, installments: created }
    })
  }
}
