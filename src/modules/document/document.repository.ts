import type { Queryable } from '../../core/db'
import type { Actor } from '../../core/types'
import { runList, type ListQuery } from '../../core/list-query'
import { deletedListConfig } from './document.schema'

/** Who acts in the workflow core: a logged-in actor, or a SYSTEM session acting for a user (portal submit side effects). */
export type WfActor = Pick<Actor, 'id' | 'userType'> & { permissions?: ReadonlySet<string> }

export type DocRow = {
  id: number; publicId: string; docType: string; docNo: string | null; docDate: string; status: string; title: string | null
  bpId: number | null; departmentId: number | null; ownerUserId: number; ownerName: string; createdBy: number | null
  currencyCode: string | null; exchangeRate: string | null; totalAmount: string | null; totalAmountBase: string | null; appliedAmount: string
  remarks: string | null; submittedAt: Date | null; cancelledAt: Date | null; cancelReason: string | null
  isDeleted: boolean; deletedAt: Date | null; deleteReason: string | null; version: number; createdAt: Date; updatedAt: Date
}

const DOC_COLS = `d."Id" AS id, d."PublicId" AS "publicId", d."DocType" AS "docType", d."DocNo" AS "docNo", to_char(d."DocDate",'YYYY-MM-DD') AS "docDate",
  d."Status" AS status, d."Title" AS title, d."BpId" AS "bpId", d."DepartmentId" AS "departmentId", d."OwnerUserId" AS "ownerUserId",
  (SELECT u."DisplayName" FROM mst_user u WHERE u."Id" = d."OwnerUserId") AS "ownerName", d."CreatedBy" AS "createdBy",
  d."CurrencyCode" AS "currencyCode", d."ExchangeRate" AS "exchangeRate", d."TotalAmount" AS "totalAmount", d."TotalAmountBase" AS "totalAmountBase",
  d."AppliedAmount" AS "appliedAmount", d."Remarks" AS remarks, d."SubmittedAt" AS "submittedAt", d."CancelledAt" AS "cancelledAt",
  d."CancelReason" AS "cancelReason", d."IsDeleted" AS "isDeleted", d."DeletedAt" AS "deletedAt", d."DeleteReason" AS "deleteReason",
  d."Version" AS version, d."CreatedAt" AS "createdAt", d."UpdatedAt" AS "updatedAt"`

/** Header columns a module may set; everything else (totals, status, number, deletion) goes through dedicated helpers. */
export const HEADER_COLS = { docDate: 'DocDate', title: 'Title', bpId: 'BpId', departmentId: 'DepartmentId', ownerUserId: 'OwnerUserId', currencyCode: 'CurrencyCode', exchangeRate: 'ExchangeRate', remarks: 'Remarks' } as const
export type HeaderInput = Partial<{ docDate: string; title: string | null; bpId: number | null; departmentId: number | null; ownerUserId: number; currencyCode: string | null; exchangeRate: string | null; remarks: string | null }>

/** SQL only. */
export class DocumentRepository {
  constructor(private q: Queryable) {}

  async insert(docType: string, h: HeaderInput, actorId: number) {
    const pairs = Object.entries(h).filter(([k, v]) => v !== undefined && k in HEADER_COLS).map(([k, v]) => [HEADER_COLS[k as keyof typeof HEADER_COLS], v] as const)
    const cols = ['DocType', 'Status', 'CreatedBy', 'UpdatedBy', ...pairs.map(([c]) => c)]
    const vals = [docType, 'DRAFT', actorId, actorId, ...pairs.map(([, v]) => v)]
    if (!h.ownerUserId) { cols.push('OwnerUserId'); vals.push(actorId) }
    if (!h.docDate) { cols.push('DocDate'); vals.push(new Date().toISOString().slice(0, 10)) }
    return (await this.q.query<{ id: number; publicId: string }>(
      `INSERT INTO tr_document (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING "Id" AS id, "PublicId" AS "publicId"`, vals))[0]!
  }

  async byId(id: number, lock = false) {
    return (await this.q.query<DocRow>(`SELECT ${DOC_COLS} FROM tr_document d WHERE d."Id"=$1${lock ? ' FOR UPDATE OF d' : ''}`, [id]))[0]
  }
  async byPublicId(publicId: string, lock = false) {
    return (await this.q.query<DocRow>(`SELECT ${DOC_COLS} FROM tr_document d WHERE d."PublicId"=$1${lock ? ' FOR UPDATE OF d' : ''}`, [publicId]))[0]
  }

  /** Optimistic update: only when Version matches and the document is still editable. Returns the new version or undefined. */
  async updateHeader(id: number, version: number, h: HeaderInput, actorId: number) {
    const pairs = Object.entries(h).filter(([k, v]) => v !== undefined && k in HEADER_COLS).map(([k, v]) => [HEADER_COLS[k as keyof typeof HEADER_COLS], v] as const)
    const sets = [...pairs.map(([c], i) => `"${c}"=$${i + 4}`), `"UpdatedBy"=$3`, `"Version"="Version"+1`]
    return (await this.q.query<{ version: number }>(
      `UPDATE tr_document SET ${sets.join(',')} WHERE "Id"=$1 AND "Version"=$2 AND NOT "IsDeleted" AND "Status" IN ('DRAFT','RETURNED','REVISION_REQUIRED') RETURNING "Version" AS version`,
      [id, version, actorId, ...pairs.map(([, v]) => v)]))[0]?.version
  }

  transition(docType: string, from: string, to: string) {
    return this.q.query<{ requiredApproval: string | null; allowBp: boolean }>(
      `SELECT "RequiredApproval" AS "requiredApproval", "AllowBp" AS "allowBp" FROM mst_status_transition WHERE "DocType"=$1 AND "FromStatus"=$2 AND "ToStatus"=$3`, [docType, from, to]).then((r) => r[0])
  }
  /** Target status for an approval outcome, e.g. RFQ: APPROVED → AWARDED, SVR: RETURNED → REVISION_REQUIRED. */
  outcomeStatus(docType: string, outcome: string) {
    return this.q.query<{ to: string }>(
      `SELECT "ToStatus" AS "to" FROM mst_status_transition WHERE "DocType"=$1 AND "FromStatus"='PENDING_APPROVAL' AND "RequiredApproval"=$2 ORDER BY "ToStatus" LIMIT 1`, [docType, outcome]).then((r) => r[0]?.to)
  }
  latestRoundStatus(docId: number) {
    return this.q.query<{ status: string }>(`SELECT "Status" AS status FROM tr_approval_request WHERE "DocumentId"=$1 ORDER BY "RoundNo" DESC LIMIT 1`, [docId]).then((r) => r[0]?.status)
  }

  async setRemarks(remarks: string) { await this.q.query(`SELECT set_config('purchasing.remarks', $1, true)`, [remarks]) }

  async setStatus(id: number, to: string, actorId: number, extra: { cancelReason?: string } = {}) {
    await this.q.query(
      `UPDATE tr_document SET "Status"=$2::text, "UpdatedBy"=$3, "Version"="Version"+1,
         "SubmittedAt" = CASE WHEN $2::text IN ('PENDING_APPROVAL','SUBMITTED') THEN now() ELSE "SubmittedAt" END,
         "CancelledAt" = CASE WHEN $2::text = 'CANCELLED' THEN now() ELSE NULL END,
         "CancelReason" = CASE WHEN $2::text = 'CANCELLED' THEN COALESCE($4::text, "CancelReason") ELSE "CancelReason" END
       WHERE "Id"=$1`, [id, to, actorId, extra.cancelReason ?? null])
  }

  async setDocNo(id: number, docNo: string) { await this.q.query(`UPDATE tr_document SET "DocNo"=$2 WHERE "Id"=$1 AND "DocNo" IS NULL`, [id, docNo]) }

  /**
   * Next number of a series, atomic: the series row stays locked until commit. A month without a row copies prefix / format
   * from the series' latest row; a series with a '000000' row never resets.
   */
  async nextNumber(series: string, docDate: string) {
    const period = (await this.q.query<{ p: string }>(
      `SELECT CASE WHEN EXISTS (SELECT 1 FROM sys_number_series WHERE "SeriesCode"=$1 AND "PeriodKey"='000000') THEN '000000' ELSE to_char($2::date,'YYYYMM') END AS p`,
      [series, docDate]))[0]!.p
    await this.q.query(
      `INSERT INTO sys_number_series ("SeriesCode","PeriodKey","Prefix","Format","LastNumber","AllowPortal")
       SELECT "SeriesCode", $2, "Prefix", "Format", 0, "AllowPortal" FROM sys_number_series WHERE "SeriesCode"=$1 ORDER BY "PeriodKey" DESC LIMIT 1
       ON CONFLICT DO NOTHING`, [series, period])
    return (await this.q.query<{ n: number; prefix: string; format: string; allowPortal: boolean }>(
      `UPDATE sys_number_series SET "LastNumber"="LastNumber"+1 WHERE "SeriesCode"=$1 AND "PeriodKey"=$2
       RETURNING "LastNumber" AS n, "Prefix" AS prefix, "Format" AS format, "AllowPortal" AS "allowPortal"`, [series, period]))[0]
  }

  async setDeleted(id: number, deleted: boolean, actorId: number, reason?: string) {
    return (await this.q.query<{ id: number }>(deleted
      ? `UPDATE tr_document SET "IsDeleted"=true,"DeletedAt"=now(),"DeletedBy"=$2,"DeleteReason"=$3,"UpdatedBy"=$2,"Version"="Version"+1 WHERE "Id"=$1 AND NOT "IsDeleted" RETURNING "Id" AS id`
      : `UPDATE tr_document SET "IsDeleted"=false,"DeletedAt"=NULL,"DeletedBy"=NULL,"DeleteReason"=NULL,"UpdatedBy"=$2,"Version"="Version"+1 WHERE "Id"=$1 AND "IsDeleted" RETURNING "Id" AS id`,
      deleted ? [id, actorId, reason] : [id, actorId])).length > 0
  }

  // ---- visibility helpers
  async bpIdsOfUser(userId: number) {
    return (await this.q.query<{ bpId: number }>(`SELECT "BpId" AS "bpId" FROM mst_bp_user WHERE "UserId"=$1 AND "IsActive"`, [userId])).map((r) => r.bpId)
  }
  async isParticipant(docId: number, userId: number) {
    return ((await this.q.query(
      `SELECT 1 FROM tr_approval_task t JOIN tr_approval_request r ON r."Id"=t."ApprovalRequestId"
        WHERE r."DocumentId"=$1 AND (t."AssigneeUserId"=$2 OR t."ActedByUserId"=$2) LIMIT 1`, [docId, userId])).length > 0)
  }

  // ---- attachments
  listAttachments(docId: number, sharedOnly: boolean) {
    return this.q.query(
      `SELECT a."PublicId" AS id, a."Category" AS category, a."Description" AS description, a."Visibility" AS visibility,
              f."OriginalName" AS "fileName", f."ContentType" AS "contentType", f."SizeBytes" AS "sizeBytes",
              a."CreatedAt" AS "createdAt", u."DisplayName" AS "createdByName", u."PublicId" AS "createdByUserId"
         FROM tr_document_attachment a JOIN sys_file f ON f."Id"=a."FileId" JOIN mst_user u ON u."Id"=a."CreatedBy"
        WHERE a."DocumentId"=$1 AND a."RemovedAt" IS NULL AND ($2::boolean = false OR a."Visibility"='SHARED')
        ORDER BY a."CreatedAt", a."Id"`, [docId, sharedOnly])
  }
  async attachment(docId: number, publicId: string) {
    return (await this.q.query<{ id: number; fileId: number; visibility: string; createdBy: number }>(
      `SELECT "Id" AS id, "FileId" AS "fileId", "Visibility" AS visibility, "CreatedBy" AS "createdBy"
         FROM tr_document_attachment WHERE "DocumentId"=$1 AND "PublicId"=$2 AND "RemovedAt" IS NULL`, [docId, publicId]))[0]
  }
  async addAttachment(docId: number, fileId: number, a: { category: string; description?: string; visibility: string }, actorId: number) {
    return (await this.q.query<{ id: string }>(
      `INSERT INTO tr_document_attachment ("DocumentId","FileId","Category","Description","Visibility","CreatedBy") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "PublicId" AS id`,
      [docId, fileId, a.category, a.description ?? null, a.visibility, actorId]))[0]!
  }
  async removeAttachment(id: number, actorId: number) {
    await this.q.query(`UPDATE tr_document_attachment SET "RemovedAt"=now(),"RemovedBy"=$2 WHERE "Id"=$1`, [id, actorId])
  }

  // ---- comments
  listComments(docId: number, sharedOnly: boolean) {
    return this.q.query(
      `SELECT c."PublicId" AS id, c."Body" AS body, c."Visibility" AS visibility, c."CreatedAt" AS "createdAt", u."DisplayName" AS "authorName", u."UserType" AS "authorType"
         FROM tr_document_comment c JOIN mst_user u ON u."Id"=c."AuthorUserId"
        WHERE c."DocumentId"=$1 AND ($2::boolean = false OR c."Visibility"='SHARED') ORDER BY c."CreatedAt", c."Id"`, [docId, sharedOnly])
  }
  async addComment(docId: number, body: string, visibility: string, actorId: number) {
    return (await this.q.query(
      `INSERT INTO tr_document_comment ("DocumentId","AuthorUserId","Body","Visibility") VALUES ($1,$2,$3,$4) RETURNING "PublicId" AS id, "CreatedAt" AS "createdAt"`,
      [docId, actorId, body, visibility]))[0]
  }

  /** Vendors invited to an RFQ (internal view only: vendors must not see their competitors). */
  rfqParticipants(rfqId: number) {
    return this.q.query(
      `SELECT bp."PublicId" AS id, bp."BpCode" AS "bpCode", bp."LegalName" AS "legalName", p."InvitationStatus" AS "invitationStatus"
         FROM tr_rfq_participant p JOIN mst_business_partner bp ON bp."Id" = p."BpId"
        WHERE p."RfqId"=$1 ORDER BY bp."BpCode"`,
      [rfqId]
    )
  }

  async subtypeDetail(docId: number, docType: string) {
    const viewByType: Record<string, string> = {
      PR: 'vw_doc_pr',
      RFQ: 'vw_doc_rfq',
      QUO: 'vw_doc_quo',
      CTR: 'vw_doc_ctr',
      PO: 'vw_doc_po',
      GR: 'vw_doc_gr',
      SVR: 'vw_doc_svr',
      CA: 'vw_doc_ca',
      STL: 'vw_doc_stl',
      RMB: 'vw_doc_rmb',
      INV: 'vw_doc_inv',
      PAY: 'vw_doc_pay',
      ARI: 'vw_doc_ari',
    }
    const vw = viewByType[docType]
    if (!vw) return null
    return (await this.q.query<Record<string, unknown>>(`SELECT * FROM ${vw} WHERE "Id"=$1`, [docId]))[0] ?? null
  }

  async subtypeLines(docId: number, docType: string) {
    switch (docType) {
      case 'PR':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId", i."Code" AS "itemCode", i."Name" AS "itemName",
                  l."Description" AS description, l."CategoryId" AS "categoryId", c."Name" AS "categoryName",
                  l."UomId" AS "uomId", u."Code" AS "uomCode", l."Quantity" AS quantity,
                  l."EstimatedUnitPrice" AS "estimatedUnitPrice", l."EstimatedUnitPrice" AS "unitPrice",
                  round(l."Quantity" * COALESCE(l."EstimatedUnitPrice", 0), 2) AS "lineTotal"
             FROM tr_purchase_request_line l
             JOIN mst_uom u ON u."Id" = l."UomId"
             LEFT JOIN mst_item i ON i."Id" = l."ItemId"
             LEFT JOIN mst_category c ON c."Id" = l."CategoryId"
            WHERE l."PurchaseRequestId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'RFQ':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId", i."Code" AS "itemCode",
                  l."Description" AS description, l."CategoryId" AS "categoryId", c."Name" AS "categoryName",
                  l."UomId" AS "uomId", u."Code" AS "uomCode", l."Quantity" AS quantity, l."Specification" AS specification
             FROM tr_rfq_line l
             JOIN mst_category c ON c."Id" = l."CategoryId"
             JOIN mst_uom u ON u."Id" = l."UomId"
             LEFT JOIN mst_item i ON i."Id" = l."ItemId"
            WHERE l."RfqId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'QUO':
        return this.q.query(
          `SELECT l."Id" AS id, rl."LineNum" AS "lineNum", l."RfqLineId" AS "rfqLineId",
                  rl."Description" AS description, u."Code" AS "uomCode",
                  l."Quantity" AS quantity, l."UnitPrice" AS "unitPrice", l."DiscountPercent" AS "discountPercent",
                  l."LineAmount" AS "lineTotal", l."LeadTimeDays" AS "leadTimeDays"
             FROM tr_quotation_line l
             JOIN tr_rfq_line rl ON rl."Id" = l."RfqLineId"
             JOIN mst_uom u ON u."Id" = rl."UomId"
            WHERE l."QuotationId"=$1 ORDER BY rl."LineNum"`,
          [docId]
        )
      case 'CTR':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId", i."Code" AS "itemCode",
                  l."Description" AS description, l."UomId" AS "uomId", u."Code" AS "uomCode",
                  l."TargetQty" AS "targetQty", l."TargetQty" AS quantity, l."UnitPrice" AS "unitPrice",
                  l."DiscountPercent" AS "discountPercent",
                  round(l."TargetQty" * l."UnitPrice" * (1 - COALESCE(l."DiscountPercent",0)/100), 2) AS "lineTotal"
             FROM tr_purchase_contract_line l
             JOIN mst_uom u ON u."Id" = l."UomId"
             LEFT JOIN mst_item i ON i."Id" = l."ItemId"
            WHERE l."ContractId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'PO':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId", i."Code" AS "itemCode",
                  l."Description" AS description, l."UomId" AS "uomId", u."Code" AS "uomCode",
                  l."Quantity" AS quantity, l."UnitPrice" AS "unitPrice", l."DiscountPercent" AS "discountPercent",
                  l."LineAmount" AS "lineTotal", l."VatAmount" AS "vatAmount"
             FROM tr_purchase_order_line l
             JOIN mst_uom u ON u."Id" = l."UomId"
             LEFT JOIN mst_item i ON i."Id" = l."ItemId"
            WHERE l."PurchaseOrderId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'GR':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."PurchaseOrderLineId" AS "poLineId",
                  pol."Description" AS description, u."Code" AS "uomCode",
                  l."ReceivedQty" AS "receivedQty", l."AcceptedQty" AS "acceptedQty", l."AcceptedQty" AS quantity,
                  l."RejectedQty" AS "rejectedQty", l."RejectReason" AS "rejectReason",
                  pol."UnitPrice" AS "unitPrice", round(l."AcceptedQty" * pol."UnitPrice", 2) AS "lineTotal"
             FROM tr_goods_receipt_line l
             JOIN tr_purchase_order_line pol ON pol."Id" = l."PurchaseOrderLineId"
             JOIN mst_uom u ON u."Id" = pol."UomId"
            WHERE l."GoodsReceiptId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'CA':
      case 'STL':
      case 'RMB':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."CoaId" AS "coaId",
                  c."AccountCode" AS "itemCode", c."AccountName" AS "itemName",
                  l."CostCenterId" AS "costCenterId", cc."Code" AS "costCenterCode",
                  l."Description" AS description, 'EXP' AS "uomCode", 1 AS quantity,
                  to_char(l."ExpenseDate", 'YYYY-MM-DD') AS "expenseDate",
                  l."Amount" AS amount, l."Amount" AS "unitPrice", l."Amount" AS "lineTotal"
             FROM tr_expense_line l
             JOIN mst_coa c ON c."Id" = l."CoaId"
             LEFT JOIN mst_cost_center cc ON cc."Id" = l."CostCenterId"
            WHERE l."DocumentId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'INV':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."CoaId" AS "coaId", c."AccountCode" AS "itemCode",
                  l."Description" AS description, 'EA' AS "uomCode", l."Quantity" AS quantity,
                  l."UnitPrice" AS "unitPrice", l."LineAmount" AS "lineTotal", l."VatAmount" AS "vatAmount"
             FROM tr_ap_invoice_line l
             LEFT JOIN mst_coa c ON c."Id" = l."CoaId"
            WHERE l."InvoiceId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'ARI':
        return this.q.query(
          `SELECT l."Id" AS id, l."LineNum" AS "lineNum", l."ItemId" AS "itemId",
                  COALESCE(i."Code", c."AccountCode") AS "itemCode",
                  l."Description" AS description, l."UomId" AS "uomId", COALESCE(u."Code", 'EA') AS "uomCode",
                  l."RevenueCoaId" AS "revenueCoaId", l."Quantity" AS quantity,
                  l."UnitPrice" AS "unitPrice", l."DiscountPercent" AS "discountPercent",
                  l."LineAmount" AS "lineTotal", l."VatAmount" AS "vatAmount"
             FROM tr_ar_invoice_line l
             LEFT JOIN mst_item i ON i."Id" = l."ItemId"
             LEFT JOIN mst_uom u ON u."Id" = l."UomId"
             LEFT JOIN mst_coa c ON c."Id" = l."RevenueCoaId"
            WHERE l."InvoiceId"=$1 ORDER BY l."LineNum"`,
          [docId]
        )
      case 'PAY':
        return this.q.query(
          `SELECT pa."TargetDocumentId" AS id, 1 AS "lineNum", td."DocType" AS "itemCode",
                  td."DocNo" || ' — ' || COALESCE(td."Title", '') AS description,
                  td."CurrencyCode" AS "uomCode", 1 AS quantity,
                  pa."AmountApplied" AS "unitPrice", pa."AmountApplied" AS "lineTotal",
                  td."PublicId" AS "targetDocId", td."DocNo" AS "targetDocNo"
             FROM tr_payment_allocation pa
             JOIN tr_document td ON td."Id" = pa."TargetDocumentId"
            WHERE pa."PaymentId"=$1`,
          [docId]
        )
      default:
        return []
    }
  }

  history(docId: number) {
    return this.q.query(
      `SELECT h."Id" AS id, h."FromStatus" AS "fromStatus", h."ToStatus" AS "toStatus", h."Remarks" AS remarks, h."ActedAt" AS "actedAt", u."DisplayName" AS "actorName"
         FROM hist_document_status h JOIN mst_user u ON u."Id"=h."ActorUserId" WHERE h."DocumentId"=$1 ORDER BY h."ActedAt", h."Id"`, [docId])
  }

  listDeleted(qs: ListQuery & { docType?: string }) {
    const where: string[] = ['t."IsDeleted"'], params: unknown[] = []
    if (qs.docType) { params.push(qs.docType); where.push(`t."DocType"=$${params.length}`) }
    return runList(this.q, deletedListConfig, qs, { where, params })
  }

  async accessLog(userId: number, action: string, objectType: string, objectKey: string, detail?: string) {
    await this.q.query(`INSERT INTO hist_access_log ("UserId","Action","ObjectType","ObjectKey","Detail") VALUES ($1,$2,$3,$4,$5)`, [userId, action, objectType, objectKey, detail ?? null])
  }
}
