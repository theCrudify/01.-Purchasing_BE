import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { isoDate } from '../_master/shared'

export const docListQuery = listQuerySchema.extend({
  status: z.string().optional(),
  purchaseClassCode: z.string().optional(),
  purpose: z.string().optional(),
})
export const docIdParam = z.object({ id: z.string().uuid() })

const dec = z.coerce.number().nonnegative()
const posDec = z.coerce.number().positive()

// 1. Purchase Request (PR)
export const prList: ListConfig = {
  table: 'vw_doc_pr',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    departmentId: 'DepartmentId',
    departmentName: 'DepartmentName',
    requiredDate: 'RequiredDate',
    purchaseClassId: 'PurchaseClassId',
    purchaseClassCode: 'PurchaseClassCode',
    purchaseClassName: 'PurchaseClassName',
    costCenterName: 'CostCenterName',
    sourcingMethod: 'SourcingMethod',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    totalAmountBase: 'TotalAmountBase',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'OwnerName', 'DepartmentName', 'PurchaseClassName'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    requiredDate: 'RequiredDate',
    status: 'Status',
    totalAmountBase: 'TotalAmountBase',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const prCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    docDate: isoDate.optional(),
    requiredDate: isoDate,
    departmentId: z.coerce.number().int().positive(),
    purchaseClassId: z.coerce.number().int().positive(),
    costCenterId: z.coerce.number().int().positive().nullable().optional(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    sourcingMethod: z.enum(['DIRECT', 'RFQ', 'CONTRACT']).default('DIRECT'),
    justification: z.string().trim().max(2000).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          itemId: z.coerce.number().int().positive().nullable().optional(),
          description: z.string().trim().min(1).max(500),
          categoryId: z.coerce.number().int().positive().nullable().optional(),
          uomId: z.coerce.number().int().positive(),
          quantity: posDec,
          estimatedUnitPrice: dec.default(0),
        })
      )
      .min(1, 'At least 1 line item is required')
      .max(100),
  })
  .strict()

// 2. Request for Quotation (RFQ)
export const rfqList: ListConfig = {
  table: 'vw_doc_rfq',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    departmentName: 'DepartmentName',
    submissionDeadline: 'SubmissionDeadline',
    quoteValidityDays: 'QuoteValidityDays',
    evaluationMethod: 'EvaluationMethod',
    currencyCode: 'CurrencyCode',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    vendorCount: 'VendorCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'OwnerName', 'DepartmentName'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    submissionDeadline: 'SubmissionDeadline',
    status: 'Status',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const rfqCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    docDate: isoDate.optional(),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    submissionDeadline: z.string().min(10),
    quoteValidityDays: z.coerce.number().int().min(1).max(365).default(30),
    evaluationMethod: z.enum(['LOWEST_PRICE', 'WEIGHTED', 'MANUAL']).default('LOWEST_PRICE'),
    currencyCode: z.string().trim().length(3).default('IDR'),
    terms: z.string().trim().max(4000).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
    vendorIds: z.array(z.string().uuid()).optional().default([]),
    lines: z
      .array(
        z.object({
          itemId: z.coerce.number().int().positive().nullable().optional(),
          description: z.string().trim().min(1).max(500),
          categoryId: z.coerce.number().int().positive(),
          uomId: z.coerce.number().int().positive(),
          quantity: posDec,
          specification: z.string().trim().max(2000).nullable().optional(),
        })
      )
      .min(1, 'At least 1 line item is required')
      .max(100),
  })
  .strict()

// 3. Vendor Quotation (QUO)
export const quoList: ListConfig = {
  table: 'vw_doc_quo',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    rfqDocNo: 'RfqDocNo',
    bpReference: 'BpReference',
    validUntil: 'ValidUntil',
    paymentTermName: 'PaymentTermName',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    totalAmountBase: 'TotalAmountBase',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'BpCode', 'RfqDocNo'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    totalAmountBase: 'TotalAmountBase',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const quoCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    rfqId: z.string().uuid(),
    bpId: z.string().uuid(),
    bpReference: z.string().trim().max(50).nullable().optional(),
    validUntil: isoDate.nullable().optional(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    paymentTermId: z.coerce.number().int().positive().nullable().optional(),
    deliveryTerms: z.string().trim().max(200).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          rfqLineId: z.coerce.number().int().positive().optional(),
          quantity: posDec,
          unitPrice: dec,
          discountPercent: dec.default(0),
          leadTimeDays: z.coerce.number().int().nonnegative().nullable().optional(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict()

// 4. Purchase Contract (CTR)
export const ctrList: ListConfig = {
  table: 'vw_doc_ctr',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    agreementType: 'AgreementType',
    startDate: 'StartDate',
    endDate: 'EndDate',
    targetAmount: 'TargetAmount',
    purchaseClassName: 'PurchaseClassName',
    paymentTermName: 'PaymentTermName',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'BpCode', 'OwnerName'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    startDate: 'StartDate',
    endDate: 'EndDate',
    status: 'Status',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const ctrCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    bpId: z.string().uuid(),
    agreementType: z.enum(['QUANTITY', 'AMOUNT']).default('QUANTITY'),
    startDate: isoDate,
    endDate: isoDate,
    targetAmount: dec.nullable().optional(),
    purchaseClassId: z.coerce.number().int().positive(),
    paymentTermId: z.coerce.number().int().positive(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    bpReference: z.string().trim().max(100).nullable().optional(),
    terms: z.string().trim().max(4000).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          itemId: z.coerce.number().int().positive().nullable().optional(),
          description: z.string().trim().min(1).max(500),
          uomId: z.coerce.number().int().positive(),
          targetQty: posDec,
          unitPrice: dec,
          discountPercent: dec.default(0),
        })
      )
      .min(1)
      .max(100),
  })
  .strict()

// 5. Purchase Order (PO)
export const poList: ListConfig = {
  table: 'vw_doc_po',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    purchaseClassName: 'PurchaseClassName',
    paymentTermName: 'PaymentTermName',
    poType: 'PoType',
    deliveryDate: 'DeliveryDate',
    currencyCode: 'CurrencyCode',
    subtotalAmount: 'SubtotalAmount',
    vatAmount: 'VatAmount',
    grandTotal: 'GrandTotal',
    totalAmount: 'TotalAmount',
    totalAmountBase: 'TotalAmountBase',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'BpCode', 'OwnerName'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    deliveryDate: 'DeliveryDate',
    status: 'Status',
    totalAmountBase: 'TotalAmountBase',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const poCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    bpId: z.string().uuid(),
    purchaseClassId: z.coerce.number().int().positive(),
    paymentTermId: z.coerce.number().int().positive(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    poType: z.enum(['STANDARD', 'BLANKET', 'SERVICE']).default('STANDARD'),
    bpReference: z.string().trim().max(100).nullable().optional(),
    shippingMethod: z.string().trim().max(50).nullable().optional(),
    deliveryDate: isoDate.nullable().optional(),
    deliveryAddress: z.string().trim().max(500).nullable().optional(),
    freightAmount: dec.default(0),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          itemId: z.coerce.number().int().positive().nullable().optional(),
          description: z.string().trim().min(1).max(500),
          uomId: z.coerce.number().int().positive(),
          quantity: posDec,
          unitPrice: dec,
          discountPercent: dec.default(0),
        })
      )
      .min(1, 'At least 1 line item is required')
      .max(100),
  })
  .strict()

// 6. Goods Receipt (GR)
export const grList: ListConfig = {
  table: 'vw_doc_gr',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    receiptKind: 'ReceiptKind',
    poId: 'PoPublicId',
    poDocNo: 'PoDocNo',
    receivedDate: 'ReceivedDate',
    deliveryNoteNo: 'DeliveryNoteNo',
    vehiclePlateNo: 'VehiclePlateNo',
    driverName: 'DriverName',
    location: 'Location',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'PoDocNo', 'DeliveryNoteNo', 'OwnerName'],
  sortable: {
    docNo: 'DocNo',
    receivedDate: 'ReceivedDate',
    status: 'Status',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const grCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    poId: z.string().uuid(),
    receiptKind: z.enum(['RECEIPT', 'RETURN']).default('RECEIPT'),
    receivedDate: isoDate,
    deliveryNoteNo: z.string().trim().max(50).nullable().optional(),
    vehiclePlateNo: z.string().trim().max(15).nullable().optional(),
    driverName: z.string().trim().max(100).nullable().optional(),
    carrierName: z.string().trim().max(100).nullable().optional(),
    location: z.string().trim().max(100).nullable().optional(),
    returnReason: z.string().trim().max(500).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          poLineId: z.coerce.number().int().positive().optional(),
          receivedQty: posDec,
          acceptedQty: dec,
          rejectedQty: dec.default(0),
          rejectReason: z.string().trim().max(500).nullable().optional(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict()

export type PrCreate = z.infer<typeof prCreate>
export type RfqCreate = z.infer<typeof rfqCreate>
export type QuoCreate = z.infer<typeof quoCreate>
export type CtrCreate = z.infer<typeof ctrCreate>
export type PoCreate = z.infer<typeof poCreate>
export type GrCreate = z.infer<typeof grCreate>
