import type { Queryable } from '../../core/db'
import { notFound } from '../../core/errors'
import { runList, type ListConfig, type ListQuery } from '../../core/list-query'
import {
  ariList,
  caList,
  invList,
  payList,
  rmbList,
  stlList,
  type AriCreate,
  type CaCreate,
  type InvCreate,
  type PayCreate,
  type RmbCreate,
  type StlCreate,
} from './finance.schema'

export class FinanceRepository {
  constructor(private q: Queryable) {}

  listDoc(cfg: ListConfig, qs: ListQuery & { status?: string; purpose?: string }, bpIds?: number[]) {
    const conds = [`NOT "IsDeleted"`]
    const params: unknown[] = []
    if (qs.status) {
      params.push(qs.status)
      conds.push(`"Status"=$${params.length}`)
    }
    if (qs.purpose) {
      params.push(qs.purpose)
      conds.push(`"Purpose"=$${params.length}`)
    }
    if (bpIds) {
      params.push(bpIds)
      conds.push(`"BpId" = ANY($${params.length}::bigint[])`)
    }
    return runList(this.q, cfg, qs, { where: conds, params })
  }

  listCa(qs: ListQuery & { status?: string }) {
    return this.listDoc(caList, qs)
  }
  listStl(qs: ListQuery & { status?: string }) {
    return this.listDoc(stlList, qs)
  }
  listRmb(qs: ListQuery & { status?: string }) {
    return this.listDoc(rmbList, qs)
  }
  listInv(qs: ListQuery & { status?: string }, bpIds?: number[]) {
    return this.listDoc(invList, qs, bpIds)
  }
  listPay(qs: ListQuery & { status?: string; purpose?: string }, bpIds?: number[]) {
    return this.listDoc(payList, qs, bpIds)
  }
  listAri(qs: ListQuery & { status?: string }, bpIds?: number[]) {
    return this.listDoc(ariList, qs, bpIds)
  }

  // Finance Master Lookups
  listCoas() {
    return this.q.query(
      `SELECT "Id" AS id, "AccountCode" AS code, "AccountName" AS name, "AccountType" AS "accountType"
         FROM mst_coa WHERE NOT "IsDeleted" AND "IsActive" ORDER BY "AccountCode"`
    )
  }

  listTransactionTypes(module?: string) {
    const params: unknown[] = []
    let where = `NOT "IsDeleted" AND "IsActive"`
    if (module) {
      params.push(module)
      where += ` AND "Module"=$1`
    }
    return this.q.query(
      `SELECT "Id" AS id, "Module" AS module, "Code" AS code, "Name" AS name
         FROM mst_transaction_type WHERE ${where} ORDER BY "Module", "Code"`,
      params
    )
  }

  listCompanyBanks() {
    return this.q.query(
      `SELECT "Id" AS id, "Code" AS code, "AccountKind" AS "accountKind", "AccountNo" AS "accountNo",
              "AccountName" AS name, "CurrencyCode" AS "currencyCode"
         FROM mst_company_bank_account WHERE NOT "IsDeleted" AND "IsActive" ORDER BY "Code"`
    )
  }

  async resolveBpId(bpPublicId: string) {
    const r = await this.q.query<{ id: number }>(
      `SELECT "Id" AS id FROM mst_business_partner WHERE "PublicId"=$1 AND NOT "IsDeleted"`,
      [bpPublicId]
    )
    if (!r[0]) throw notFound('Business Partner')
    return r[0].id
  }

  async ensureEmployeeForUser(userId: number, deptId?: number | null) {
    const existing = await this.q.query<{ id: number }>(
      `SELECT "UserId" AS id FROM mst_employee WHERE "UserId"=$1`,
      [userId]
    )
    if (existing[0]) return existing[0].id
    const fallbackDept =
      deptId ??
      (await this.q.query<{ id: number }>(`SELECT "Id" AS id FROM mst_department WHERE NOT "IsDeleted" ORDER BY "Id" LIMIT 1`))[0]?.id ??
      1
    await this.q.query(
      `INSERT INTO mst_employee ("UserId","EmployeeNo","DepartmentId","JobTitle","JoinDate","IsActive")
       VALUES ($1, 'EMP-' || lpad($1::text, 4, '0'), $2, 'Staff', CURRENT_DATE, true)
       ON CONFLICT ("UserId") DO NOTHING`,
      [userId, fallbackDept]
    )
    return userId
  }

  async defaultExpenseCoaId() {
    const r = await this.q.query<{ id: number }>(
      `SELECT "Id" AS id FROM mst_coa WHERE NOT "IsDeleted" AND "IsActive" ORDER BY CASE WHEN "AccountType"='EXPENSE' THEN 0 ELSE 1 END, "Id" LIMIT 1`
    )
    return r[0]?.id ?? 1
  }

  async defaultRevenueCoaId() {
    const r = await this.q.query<{ id: number }>(
      `SELECT "Id" AS id FROM mst_coa WHERE NOT "IsDeleted" AND "IsActive" ORDER BY CASE WHEN "AccountType"='REVENUE' THEN 0 ELSE 1 END, "Id" LIMIT 1`
    )
    return r[0]?.id ?? 1
  }

  async insertExpenseLines(docId: number, lines: CaCreate['lines']) {
    let total = 0
    for (const [i, l] of lines.entries()) {
      const amt = Number(l.amount)
      total += amt
      await this.q.query(
        `INSERT INTO tr_expense_line ("DocumentId","LineNum","CoaId","CostCenterId","Description","ExpenseDate","Amount")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [docId, i + 1, l.coaId, l.costCenterId ?? null, l.description, l.expenseDate ?? null, amt.toFixed(2)]
      )
    }
    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2, "TotalAmountBase"=$2 WHERE "Id"=$1`, [
      docId,
      total.toFixed(2),
    ])
    return total
  }

  async expenseLines(docId: number) {
    return this.q.query(
      `SELECT l."Id" AS id, l."LineNum" AS "lineNum", c."AccountCode" AS "itemCode", c."AccountName" AS "itemName",
              l."Description" AS description, 'EXP' AS "uomCode", 1 AS quantity,
              l."Amount" AS "unitPrice", l."Amount" AS "lineTotal", l."ExpenseDate" AS "expenseDate"
         FROM tr_expense_line l
         JOIN mst_coa c ON c."Id" = l."CoaId"
        WHERE l."DocumentId"=$1 ORDER BY l."LineNum"`,
      [docId]
    )
  }

  async insertCa(docId: number, actorId: number, d: CaCreate) {
    const empUserId = await this.ensureEmployeeForUser(actorId, d.departmentId)
    await this.q.query(
      `INSERT INTO tr_cash_advance ("DocumentId","EmployeeUserId","TransactionTypeId","Purpose","RequiredDate")
       VALUES ($1,$2,$3,$4,$5)`,
      [docId, empUserId, d.transactionTypeId, d.purpose, d.requiredDate ?? null]
    )
    await this.insertExpenseLines(docId, d.lines)
  }

  async insertStl(docId: number, d: StlCreate) {
    const caDoc = (
      await this.q.query<{ id: number; totalAmount: string }>(
        `SELECT "Id" AS id, COALESCE("TotalAmount", 0)::text AS "totalAmount"
           FROM tr_document WHERE "PublicId"=$1 AND "DocType"='CA' AND NOT "IsDeleted"`,
        [d.caId]
      )
    )[0]
    if (!caDoc) throw notFound('Cash Advance document')

    const spent = await this.insertExpenseLines(docId, d.lines)
    const adv = Number(caDoc.totalAmount)
    const diff = adv - spent

    await this.q.query(
      `INSERT INTO tr_settlement ("DocumentId","CashAdvanceId","Purpose","ReferenceNo","AdvanceAmount","SpentAmount","DifferenceAmount")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [docId, caDoc.id, d.purpose ?? null, d.referenceNo ?? null, adv.toFixed(2), spent.toFixed(2), diff.toFixed(2)]
    )
  }

  async insertRmb(docId: number, actorId: number, bpId: number | null, d: RmbCreate) {
    const empUserId = d.payeeType === 'EMPLOYEE' ? await this.ensureEmployeeForUser(actorId, d.departmentId) : null
    await this.q.query(
      `INSERT INTO tr_reimbursement ("DocumentId","PayeeType","EmployeeUserId","TransactionTypeId","ReferenceNo")
       VALUES ($1,$2,$3,$4,$5)`,
      [docId, d.payeeType, empUserId, d.transactionTypeId, d.referenceNo ?? null]
    )
    if (bpId) {
      await this.q.query(`UPDATE tr_document SET "BpId"=$2 WHERE "Id"=$1`, [docId, bpId])
    }
    await this.insertExpenseLines(docId, d.lines)
  }

  async insertInv(docId: number, bpId: number, d: InvCreate) {
    let poDocId: number | null = null
    if (d.poId) {
      const po = (
        await this.q.query<{ id: number }>(
          `SELECT "Id" AS id FROM tr_document WHERE "PublicId"=$1 AND "DocType"='PO' AND NOT "IsDeleted"`,
          [d.poId]
        )
      )[0]
      if (po) poDocId = po.id
    }

    const fallbackCoa = await this.defaultExpenseCoaId()
    let txAmount = 0
    const computed: { l: InvCreate['lines'][number]; lineAmt: number; vatAmt: number; coaId: number }[] = []
    for (const l of d.lines) {
      const disc = Number(l.discountPercent ?? 0)
      const lineAmt = Number(l.quantity) * Number(l.unitPrice) * (1 - disc / 100)
      const vatAmt = lineAmt * 0.11
      txAmount += lineAmt
      computed.push({ l, lineAmt, vatAmt, coaId: l.coaId ?? fallbackCoa })
    }
    const vatTotal = txAmount * 0.11
    const whtTotal = Number(d.whtAmount ?? 0)
    const netPayable = txAmount + vatTotal - whtTotal

    await this.q.query(
      `INSERT INTO tr_ap_invoice
        ("DocumentId","InvoiceKind","BpId","PurchaseOrderId","BpInvoiceNo","TaxInvoiceNo","InvoiceDate","DueDate",
         "TransactionAmount","DownPaymentAmount","TaxBaseAmount","VatAmount","WhtAmount","NetPayable")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$9,$10,$11,$12)`,
      [
        docId,
        d.invoiceKind,
        bpId,
        poDocId,
        d.bpInvoiceNo,
        d.taxInvoiceNo ?? null,
        d.invoiceDate,
        d.dueDate ?? null,
        txAmount.toFixed(2),
        vatTotal.toFixed(2),
        whtTotal.toFixed(2),
        netPayable.toFixed(2),
      ]
    )

    for (const [i, { l, lineAmt, vatAmt, coaId }] of computed.entries()) {
      await this.q.query(
        `INSERT INTO tr_ap_invoice_line
          ("InvoiceId","LineNum","Description","Quantity","UnitPrice","LineAmount","VatAmount","CoaId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          docId,
          i + 1,
          l.description,
          l.quantity,
          l.unitPrice,
          lineAmt.toFixed(2),
          vatAmt.toFixed(2),
          coaId,
        ]
      )
    }

    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2, "TotalAmountBase"=$2 WHERE "Id"=$1`, [
      docId,
      netPayable.toFixed(2),
    ])
  }

  async invLines(docId: number) {
    return this.q.query(
      `SELECT l."Id" AS id, l."LineNum" AS "lineNum", c."AccountCode" AS "itemCode",
              l."Description" AS description, 'EA' AS "uomCode", l."Quantity" AS quantity,
              l."UnitPrice" AS "unitPrice", l."LineAmount" AS "lineAmount", l."VatAmount" AS "vatAmount"
         FROM tr_ap_invoice_line l
         LEFT JOIN mst_coa c ON c."Id" = l."CoaId"
        WHERE l."InvoiceId"=$1 ORDER BY l."LineNum"`,
      [docId]
    )
  }

  async insertPay(docId: number, d: PayCreate) {
    const target = (
      await this.q.query<{ id: number; bpId: number | null; docType: string }>(
        `SELECT "Id" AS id, "BpId" AS "bpId", "DocType" AS "docType"
           FROM tr_document WHERE "PublicId"=$1 AND NOT "IsDeleted"`,
        [d.targetDocId]
      )
    )[0]
    if (!target) throw notFound('Target document for payment')

    const payeeType = d.purpose === 'AP_INVOICE' || target.bpId ? 'BP' : 'EMPLOYEE'
    if (target.bpId) {
      await this.q.query(`UPDATE tr_document SET "BpId"=$2 WHERE "Id"=$1`, [docId, target.bpId])
    }

    await this.q.query(
      `INSERT INTO tr_payment
        ("DocumentId","Purpose","PayeeType","CompanyBankAccountId","PaymentMethod","PlannedDate","BankReference")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [docId, d.purpose, payeeType, d.companyBankAccountId, d.paymentMethod, d.plannedDate, d.bankReference ?? null]
    )

    const amt = Number(d.amountApplied)
    await this.q.query(
      `INSERT INTO tr_payment_allocation
        ("PaymentId","TargetDocumentId","AmountApplied","DiscountAmount","AmountInPaymentCurrency","FxDifferenceBase")
       VALUES ($1,$2,$3,0,$3,0)`,
      [docId, target.id, amt.toFixed(2)]
    )

    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2, "TotalAmountBase"=$2 WHERE "Id"=$1`, [
      docId,
      amt.toFixed(2),
    ])
  }

  async insertAri(docId: number, d: AriCreate) {
    const fallbackRevCoa = await this.defaultRevenueCoaId()
    let subtotal = 0
    const computed: { l: AriCreate['lines'][number]; lineAmt: number; vatAmt: number; coaId: number }[] = []
    for (const l of d.lines) {
      const disc = Number(l.discountPercent ?? 0)
      const lineAmt = Number(l.quantity) * Number(l.unitPrice) * (1 - disc / 100)
      const vatAmt = lineAmt * 0.11
      subtotal += lineAmt
      computed.push({ l, lineAmt, vatAmt, coaId: l.revenueCoaId ?? fallbackRevCoa })
    }
    const vatTotal = subtotal * 0.11
    const netRec = subtotal + vatTotal

    await this.q.query(
      `INSERT INTO tr_ar_invoice
        ("DocumentId","InvoiceKind","CustomerPoNo","CommercialInvoiceNo","TaxInvoiceNo","InvoiceDate","DueDate",
         "SubtotalAmount","DiscountAmount","FreightAmount","DownPaymentAmount","TaxBaseAmount","VatAmount","WhtAmount","NetReceivable")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,0,$8,$9,0,$10)`,
      [
        docId,
        d.invoiceKind,
        d.customerPoNo ?? null,
        d.commercialInvoiceNo ?? null,
        d.taxInvoiceNo ?? null,
        d.invoiceDate,
        d.dueDate ?? null,
        subtotal.toFixed(2),
        vatTotal.toFixed(2),
        netRec.toFixed(2),
      ]
    )

    for (const [i, { l, lineAmt, vatAmt, coaId }] of computed.entries()) {
      await this.q.query(
        `INSERT INTO tr_ar_invoice_line
          ("InvoiceId","LineNum","ItemId","Description","Quantity","UomId","UnitPrice","DiscountPercent","LineAmount","VatAmount","RevenueCoaId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          docId,
          i + 1,
          l.itemId ?? null,
          l.description,
          l.quantity,
          l.uomId ?? null,
          l.unitPrice,
          l.discountPercent ?? 0,
          lineAmt.toFixed(2),
          vatAmt.toFixed(2),
          coaId,
        ]
      )
    }

    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2, "TotalAmountBase"=$2 WHERE "Id"=$1`, [
      docId,
      netRec.toFixed(2),
    ])
  }

  async ariLines(docId: number) {
    return this.q.query(
      `SELECT l."Id" AS id, l."LineNum" AS "lineNum", COALESCE(i."Code", c."AccountCode") AS "itemCode",
              l."Description" AS description, COALESCE(u."Code", 'EA') AS "uomCode", l."Quantity" AS quantity,
              l."UnitPrice" AS "unitPrice", l."LineAmount" AS "lineAmount", l."VatAmount" AS "vatAmount"
         FROM tr_ar_invoice_line l
         LEFT JOIN mst_item i ON i."Id" = l."ItemId"
         LEFT JOIN mst_uom u ON u."Id" = l."UomId"
         LEFT JOIN mst_coa c ON c."Id" = l."RevenueCoaId"
        WHERE l."InvoiceId"=$1 ORDER BY l."LineNum"`,
      [docId]
    )
  }
}
