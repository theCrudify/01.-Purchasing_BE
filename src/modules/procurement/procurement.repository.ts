import type { Queryable } from '../../core/db'
import { notFound } from '../../core/errors'
import { runList, type ListConfig, type ListQuery } from '../../core/list-query'
import {
  ctrList,
  grList,
  poList,
  prList,
  quoList,
  rfqList,
  type CtrCreate,
  type GrCreate,
  type PoCreate,
  type PrCreate,
  type QuoCreate,
  type RfqCreate,
} from './procurement.schema'

export class ProcurementRepository {
  constructor(private q: Queryable) {}

  listDoc(cfg: ListConfig, qs: ListQuery & { status?: string }, bpIds?: number[]) {
    const conds = [`NOT "IsDeleted"`]
    const params: unknown[] = []
    if (qs.status) {
      params.push(qs.status)
      conds.push(`"Status"=$${params.length}`)
    }
    if (bpIds) {
      params.push(bpIds)
      conds.push(`"BpId" = ANY($${params.length}::bigint[])`)
    }
    return runList(this.q, cfg, qs, { where: conds, params })
  }

  listPr(qs: ListQuery & { status?: string; purchaseClassCode?: string }) {
    const conds = [`NOT "IsDeleted"`]
    const params: unknown[] = []
    if (qs.status) {
      params.push(qs.status)
      conds.push(`"Status"=$${params.length}`)
    }
    if (qs.purchaseClassCode) {
      params.push(qs.purchaseClassCode)
      conds.push(`"PurchaseClassCode"=$${params.length}`)
    }
    return runList(this.q, prList, qs, { where: conds, params })
  }
  listRfq(qs: ListQuery & { status?: string }) {
    return this.listDoc(rfqList, qs)
  }
  listQuo(qs: ListQuery & { status?: string }, bpIds?: number[]) {
    return this.listDoc(quoList, qs, bpIds)
  }
  listCtr(qs: ListQuery & { status?: string }, bpIds?: number[]) {
    return this.listDoc(ctrList, qs, bpIds)
  }
  listPo(qs: ListQuery & { status?: string }, bpIds?: number[]) {
    return this.listDoc(poList, qs, bpIds)
  }
  listGr(qs: ListQuery & { status?: string }, bpIds?: number[]) {
    return this.listDoc(grList, qs, bpIds)
  }

  async resolveBpId(bpPublicId: string) {
    const r = await this.q.query<{ id: number }>(
      `SELECT "Id" AS id FROM mst_business_partner WHERE "PublicId"=$1 AND NOT "IsDeleted"`,
      [bpPublicId]
    )
    if (!r[0]) throw notFound('Vendor / Business Partner')
    return r[0].id
  }

  async insertPr(docId: number, d: PrCreate) {
    await this.q.query(
      `INSERT INTO tr_purchase_request ("DocumentId","RequiredDate","PurchaseClassId","CostCenterId","SourcingMethod","Justification")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [docId, d.requiredDate, d.purchaseClassId, d.costCenterId ?? null, d.sourcingMethod, d.justification ?? null]
    )
    let total = 0
    for (const [i, l] of d.lines.entries()) {
      const amt = Number(l.quantity) * Number(l.estimatedUnitPrice ?? 0)
      total += amt
      await this.q.query(
        `INSERT INTO tr_purchase_request_line
          ("PurchaseRequestId","LineNum","ItemId","Description","CategoryId","UomId","Quantity","EstimatedUnitPrice","RequiredDate")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          docId,
          i + 1,
          l.itemId ?? null,
          l.description,
          l.categoryId ?? null,
          l.uomId,
          l.quantity,
          l.estimatedUnitPrice ?? 0,
          d.requiredDate,
        ]
      )
    }
    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2 WHERE "Id"=$1`, [docId, total.toFixed(2)])
  }

  async prLines(docId: number) {
    return this.q.query(
      `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId", i."Code" AS "itemCode", i."Name" AS "itemName",
              l."Description" AS description, l."UomId" AS "uomId", u."Code" AS "uomCode",
              l."Quantity" AS quantity, l."EstimatedUnitPrice" AS "estimatedUnitPrice",
              round(l."Quantity" * COALESCE(l."EstimatedUnitPrice", 0), 2) AS "lineTotal",
              l."OrderedQty" AS "orderedQty", l."LineStatus" AS "lineStatus"
         FROM tr_purchase_request_line l
         JOIN mst_uom u ON u."Id" = l."UomId"
         LEFT JOIN mst_item i ON i."Id" = l."ItemId"
        WHERE l."PurchaseRequestId"=$1 ORDER BY l."LineNum"`,
      [docId]
    )
  }

  async insertRfq(docId: number, d: RfqCreate, actorId: number) {
    await this.q.query(
      `INSERT INTO tr_rfq ("DocumentId","SubmissionDeadline","QuoteValidityDays","EvaluationMethod","Terms","PublishedAt")
       VALUES ($1,$2,$3,$4,$5,now())`,
      [docId, new Date(d.submissionDeadline).toISOString(), d.quoteValidityDays, d.evaluationMethod, d.terms ?? null]
    )
    for (const [i, l] of d.lines.entries()) {
      await this.q.query(
        `INSERT INTO tr_rfq_line ("RfqId","LineNum","ItemId","Description","CategoryId","UomId","Quantity","Specification")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [docId, i + 1, l.itemId ?? null, l.description, l.categoryId, l.uomId, l.quantity, l.specification ?? null]
      )
    }
    for (const vPub of d.vendorIds ?? []) {
      const bpId = await this.resolveBpId(vPub)
      await this.q.query(
        `INSERT INTO tr_rfq_participant ("RfqId","BpId","InvitedBy") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [docId, bpId, actorId]
      )
    }
  }

  async rfqLines(docId: number) {
    return this.q.query(
      `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."Description" AS description,
              c."Name" AS "categoryName", u."Code" AS "uomCode", l."Quantity" AS quantity, l."Specification" AS specification
         FROM tr_rfq_line l
         JOIN mst_category c ON c."Id" = l."CategoryId"
         JOIN mst_uom u ON u."Id" = l."UomId"
        WHERE l."RfqId"=$1 ORDER BY l."LineNum"`,
      [docId]
    )
  }

  async insertQuo(docId: number, bpId: number, d: QuoCreate, actorId: number) {
    const rfqRow = (
      await this.q.query<{ id: number }>(
        `SELECT "Id" AS id FROM tr_document WHERE "PublicId"=$1 AND "DocType"='RFQ' AND NOT "IsDeleted"`,
        [d.rfqId]
      )
    )[0]
    if (!rfqRow) throw notFound('RFQ document')

    let part = (
      await this.q.query<{ id: number }>(
        `SELECT "Id" AS id FROM tr_rfq_participant WHERE "RfqId"=$1 AND "BpId"=$2`,
        [rfqRow.id, bpId]
      )
    )[0]
    if (!part) {
      part = (
        await this.q.query<{ id: number }>(
          `INSERT INTO tr_rfq_participant ("RfqId","BpId","InvitationStatus","InvitedBy","RespondedAt")
           VALUES ($1,$2,'QUOTED',$3,now()) RETURNING "Id" AS id`,
          [rfqRow.id, bpId, actorId]
        )
      )[0]
    }

    const rfqLines = await this.q.query<{ id: number }>(
      `SELECT "Id" AS id FROM tr_rfq_line WHERE "RfqId"=$1 ORDER BY "LineNum"`,
      [rfqRow.id]
    )

    await this.q.query(
      `INSERT INTO tr_quotation ("DocumentId","RfqParticipantId","BpReference","ValidUntil","PaymentTermId","DeliveryTerms")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [docId, part!.id, d.bpReference ?? null, d.validUntil ?? null, d.paymentTermId ?? null, d.deliveryTerms ?? null]
    )

    let total = 0
    for (const [i, l] of d.lines.entries()) {
      const targetRfqLineId = l.rfqLineId ?? rfqLines[i]?.id ?? rfqLines[0]?.id
      if (!targetRfqLineId) throw notFound('RFQ line item')
      const disc = Number(l.discountPercent ?? 0)
      const lineAmt = Number(l.quantity) * Number(l.unitPrice) * (1 - disc / 100)
      total += lineAmt
      await this.q.query(
        `INSERT INTO tr_quotation_line ("QuotationId","RfqLineId","Quantity","UnitPrice","DiscountPercent","LineAmount","LeadTimeDays")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [docId, targetRfqLineId, l.quantity, l.unitPrice, disc, lineAmt.toFixed(2), l.leadTimeDays ?? null]
      )
    }
    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2 WHERE "Id"=$1`, [docId, total.toFixed(2)])
  }

  async insertCtr(docId: number, d: CtrCreate) {
    let total = 0
    for (const l of d.lines) {
      const disc = Number(l.discountPercent ?? 0)
      total += Number(l.targetQty) * Number(l.unitPrice) * (1 - disc / 100)
    }
    const targetAmt = d.targetAmount ?? total
    await this.q.query(
      `INSERT INTO tr_purchase_contract
        ("DocumentId","AgreementType","StartDate","EndDate","TargetAmount","PurchaseClassId","PaymentTermId","BpReference","Terms")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        docId,
        d.agreementType,
        d.startDate,
        d.endDate,
        Number(targetAmt).toFixed(2),
        d.purchaseClassId,
        d.paymentTermId,
        d.bpReference ?? null,
        d.terms ?? null,
      ]
    )
    for (const [i, l] of d.lines.entries()) {
      await this.q.query(
        `INSERT INTO tr_purchase_contract_line
          ("ContractId","LineNum","ItemId","Description","UomId","TargetQty","UnitPrice","DiscountPercent")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [docId, i + 1, l.itemId ?? null, l.description, l.uomId, l.targetQty, l.unitPrice, l.discountPercent ?? 0]
      )
    }
    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2 WHERE "Id"=$1`, [docId, Number(targetAmt).toFixed(2)])
  }

  async insertPo(docId: number, d: PoCreate) {
    let subtotal = 0
    const computedLines: { l: PoCreate['lines'][number]; lineAmt: number; vatAmt: number }[] = []
    for (const l of d.lines) {
      const disc = Number(l.discountPercent ?? 0)
      const lineAmt = Number(l.quantity) * Number(l.unitPrice) * (1 - disc / 100)
      const vatAmt = lineAmt * 0.11
      subtotal += lineAmt
      computedLines.push({ l, lineAmt, vatAmt })
    }
    const vatTotal = subtotal * 0.11
    const freight = Number(d.freightAmount ?? 0)
    const grandTotal = subtotal + vatTotal + freight

    await this.q.query(
      `INSERT INTO tr_purchase_order
        ("DocumentId","PurchaseClassId","PaymentTermId","PoType","BpReference","ShippingMethod","DeliveryDate","DeliveryAddress",
         "SubtotalAmount","DiscountAmount","FreightAmount","VatAmount","GrandTotal")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12)`,
      [
        docId,
        d.purchaseClassId,
        d.paymentTermId,
        d.poType,
        d.bpReference ?? null,
        d.shippingMethod ?? null,
        d.deliveryDate ?? null,
        d.deliveryAddress ?? null,
        subtotal.toFixed(2),
        freight.toFixed(2),
        vatTotal.toFixed(2),
        grandTotal.toFixed(2),
      ]
    )

    for (const [i, { l, lineAmt, vatAmt }] of computedLines.entries()) {
      await this.q.query(
        `INSERT INTO tr_purchase_order_line
          ("PurchaseOrderId","LineNum","ItemId","Description","UomId","Quantity","UnitPrice","DiscountPercent","LineAmount","VatAmount","DeliveryDate")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          docId,
          i + 1,
          l.itemId ?? null,
          l.description,
          l.uomId,
          l.quantity,
          l.unitPrice,
          l.discountPercent ?? 0,
          lineAmt.toFixed(2),
          vatAmt.toFixed(2),
          d.deliveryDate ?? null,
        ]
      )
    }
    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2 WHERE "Id"=$1`, [docId, grandTotal.toFixed(2)])
  }

  async poLines(docId: number) {
    return this.q.query(
      `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId", i."Code" AS "itemCode",
              l."Description" AS description, u."Code" AS "uomCode", l."Quantity" AS quantity,
              l."UnitPrice" AS "unitPrice", l."DiscountPercent" AS "discountPercent",
              l."LineAmount" AS "lineAmount", l."VatAmount" AS "vatAmount", l."ReceivedQty" AS "receivedQty"
         FROM tr_purchase_order_line l
         JOIN mst_uom u ON u."Id" = l."UomId"
         LEFT JOIN mst_item i ON i."Id" = l."ItemId"
        WHERE l."PurchaseOrderId"=$1 ORDER BY l."LineNum"`,
      [docId]
    )
  }

  async insertGr(docId: number, d: GrCreate, actorId: number) {
    const poRow = (
      await this.q.query<{ id: number; bpId: number | null }>(
        `SELECT "Id" AS id, "BpId" AS "bpId" FROM tr_document WHERE "PublicId"=$1 AND "DocType"='PO' AND NOT "IsDeleted"`,
        [d.poId]
      )
    )[0]
    if (!poRow) throw notFound('Purchase Order')

    if (poRow.bpId) {
      await this.q.query(`UPDATE tr_document SET "BpId"=$2 WHERE "Id"=$1`, [docId, poRow.bpId])
    }

    await this.q.query(
      `INSERT INTO tr_goods_receipt
        ("DocumentId","ReceiptKind","ReturnReason","PurchaseOrderId","ReceivedDate","ReceivedBy",
         "DeliveryNoteNo","VehiclePlateNo","DriverName","CarrierName","Location")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        docId,
        d.receiptKind,
        d.returnReason ?? null,
        poRow.id,
        d.receivedDate,
        actorId,
        d.deliveryNoteNo ?? null,
        d.vehiclePlateNo ?? null,
        d.driverName ?? null,
        d.carrierName ?? null,
        d.location ?? null,
      ]
    )

    const poLines = await this.q.query<{ id: number; unitPrice: string }>(
      `SELECT "Id" AS id, "UnitPrice" AS "unitPrice" FROM tr_purchase_order_line WHERE "PurchaseOrderId"=$1 ORDER BY "LineNum"`,
      [poRow.id]
    )

    let total = 0
    for (const [i, l] of d.lines.entries()) {
      const targetPoLine = l.poLineId ? poLines.find((p) => p.id === l.poLineId) : poLines[i] ?? poLines[0]
      if (!targetPoLine) throw notFound('Purchase Order line item')
      total += Number(l.acceptedQty) * Number(targetPoLine.unitPrice ?? 0)
      await this.q.query(
        `INSERT INTO tr_goods_receipt_line
          ("GoodsReceiptId","LineNum","PurchaseOrderLineId","ReceivedQty","AcceptedQty","RejectedQty","RejectReason")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          docId,
          i + 1,
          targetPoLine.id,
          l.receivedQty,
          l.acceptedQty,
          l.rejectedQty ?? 0,
          l.rejectReason ?? null,
        ]
      )
    }
    await this.q.query(`UPDATE tr_document SET "TotalAmount"=$2 WHERE "Id"=$1`, [docId, total.toFixed(2)])
  }
}
