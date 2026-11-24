import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { isoDate } from '../_master/shared'

export const finListQuery = listQuerySchema.extend({
  status: z.string().optional(),
  purpose: z.string().optional(),
  module: z.string().optional(),
})
export const finIdParam = z.object({ id: z.string().uuid() })

const dec = z.coerce.number().nonnegative()
const posDec = z.coerce.number().positive()

const expenseLineInput = z.object({
  coaId: z.coerce.number().int().positive(),
  costCenterId: z.coerce.number().int().positive().nullable().optional(),
  description: z.string().trim().min(1).max(500),
  expenseDate: isoDate.nullable().optional(),
  amount: posDec,
})

// 1. Cash Advance (CA)
export const caList: ListConfig = {
  table: 'vw_doc_ca',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    departmentId: 'DepartmentId',
    departmentName: 'DepartmentName',
    employeeUserId: 'EmployeeUserId',
    employeeNo: 'EmployeeNo',
    employeeName: 'EmployeeName',
    transactionTypeId: 'TransactionTypeId',
    transactionTypeCode: 'TransactionTypeCode',
    transactionTypeName: 'TransactionTypeName',
    purpose: 'Purpose',
    requiredDate: 'RequiredDate',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    totalAmountBase: 'TotalAmountBase',
    appliedAmount: 'AppliedAmount',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'EmployeeName', 'Purpose', 'TransactionTypeName'],
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

export const caCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    transactionTypeId: z.coerce.number().int().positive(),
    purpose: z.string().trim().min(2).max(1000),
    requiredDate: isoDate.nullable().optional(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z.array(expenseLineInput).min(1, 'At least 1 expense breakdown line is required').max(100),
  })
  .strict()

// 2. Cash Advance Settlement (STL)
export const stlList: ListConfig = {
  table: 'vw_doc_stl',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    departmentName: 'DepartmentName',
    caId: 'CaPublicId',
    caDocNo: 'CaDocNo',
    caTitle: 'CaTitle',
    purpose: 'Purpose',
    referenceNo: 'ReferenceNo',
    advanceAmount: 'AdvanceAmount',
    spentAmount: 'SpentAmount',
    differenceAmount: 'DifferenceAmount',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'CaDocNo', 'OwnerName', 'ReferenceNo'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    spentAmount: 'SpentAmount',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const stlCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    caId: z.string().uuid(),
    purpose: z.string().trim().max(1000).nullable().optional(),
    referenceNo: z.string().trim().max(100).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z.array(expenseLineInput).min(1, 'At least 1 actual expense line is required').max(100),
  })
  .strict()

// 3. Reimbursement (RMB)
export const rmbList: ListConfig = {
  table: 'vw_doc_rmb',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    departmentName: 'DepartmentName',
    payeeType: 'PayeeType',
    employeeName: 'EmployeeName',
    bpCode: 'BpCode',
    bpName: 'BpName',
    transactionTypeName: 'TransactionTypeName',
    referenceNo: 'ReferenceNo',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    totalAmountBase: 'TotalAmountBase',
    appliedAmount: 'AppliedAmount',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'EmployeeName', 'BpName', 'ReferenceNo', 'TransactionTypeName'],
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

export const rmbCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    payeeType: z.enum(['EMPLOYEE', 'BP']).default('EMPLOYEE'),
    bpId: z.string().uuid().nullable().optional(),
    transactionTypeId: z.coerce.number().int().positive(),
    referenceNo: z.string().trim().max(100).nullable().optional(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z.array(expenseLineInput).min(1, 'At least 1 reimbursement claim line is required').max(100),
  })
  .strict()

// 4. AP Invoice (INV)
export const invList: ListConfig = {
  table: 'vw_doc_inv',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    invoiceKind: 'InvoiceKind',
    poId: 'PoPublicId',
    poDocNo: 'PoDocNo',
    bpInvoiceNo: 'BpInvoiceNo',
    taxInvoiceNo: 'TaxInvoiceNo',
    invoiceDate: 'InvoiceDate',
    dueDate: 'DueDate',
    transactionAmount: 'TransactionAmount',
    vatAmount: 'VatAmount',
    whtAmount: 'WhtAmount',
    netPayable: 'NetPayable',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    appliedAmount: 'AppliedAmount',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'BpCode', 'BpInvoiceNo', 'TaxInvoiceNo', 'PoDocNo'],
  sortable: {
    docNo: 'DocNo',
    invoiceDate: 'InvoiceDate',
    dueDate: 'DueDate',
    status: 'Status',
    totalAmount: 'TotalAmount',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const invCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    bpId: z.string().uuid(),
    poId: z.string().uuid().nullable().optional(),
    invoiceKind: z.enum(['INVOICE', 'DOWN_PAYMENT', 'CREDIT_MEMO']).default('INVOICE'),
    bpInvoiceNo: z.string().trim().min(1).max(50),
    taxInvoiceNo: z.string().trim().max(30).nullable().optional(),
    invoiceDate: isoDate,
    dueDate: isoDate.nullable().optional(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    whtAmount: dec.default(0),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(500),
          coaId: z.coerce.number().int().positive().nullable().optional(),
          quantity: posDec,
          unitPrice: dec,
          discountPercent: dec.default(0),
        })
      )
      .min(1, 'At least 1 invoice line is required')
      .max(100),
  })
  .strict()

// 5. Outgoing Payment (PAY: OPAP / OPCA / OPRMB)
export const payList: ListConfig = {
  table: 'vw_doc_pay',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    purpose: 'Purpose',
    payeeType: 'PayeeType',
    paymentMethod: 'PaymentMethod',
    companyBankCode: 'CompanyBankCode',
    companyBankName: 'CompanyBankName',
    plannedDate: 'PlannedDate',
    paidDate: 'PaidDate',
    bankReference: 'BankReference',
    targetDocNo: 'TargetDocNo',
    targetDocPublicId: 'TargetDocPublicId',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    totalAmountBase: 'TotalAmountBase',
    ownerName: 'OwnerName',
    allocationCount: 'AllocationCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'TargetDocNo', 'BankReference', 'CompanyBankName'],
  sortable: {
    docNo: 'DocNo',
    docDate: 'DocDate',
    plannedDate: 'PlannedDate',
    status: 'Status',
    totalAmountBase: 'TotalAmountBase',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const payCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    purpose: z.enum(['AP_INVOICE', 'CASH_ADVANCE', 'REIMBURSEMENT']),
    targetDocId: z.string().uuid(),
    companyBankAccountId: z.coerce.number().int().positive(),
    paymentMethod: z.enum(['TRANSFER', 'CASH', 'GIRO']).default('TRANSFER'),
    plannedDate: isoDate,
    amountApplied: posDec,
    bankReference: z.string().trim().max(100).nullable().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()

export const payMufgAction = z
  .object({
    mode: z.enum(['AUTO', 'SEND', 'COMPLETE', 'FAIL']).default('AUTO'),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()

export const payInstallments = z
  .object({
    targetDocId: z.string().uuid(),
    companyBankAccountId: z.coerce.number().int().positive(),
    paymentMethod: z.enum(['TRANSFER', 'CASH', 'GIRO']).default('TRANSFER'),
    autoPayFirst: z.boolean().default(false),
    schedule: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(100),
          percent: z.coerce.number().positive().max(100),
          plannedDate: isoDate,
        })
      )
      .min(1)
      .max(12),
  })
  .strict()

// 6. AR Invoice (ARI)
export const ariList: ListConfig = {
  table: 'vw_doc_ari',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    invoiceKind: 'InvoiceKind',
    customerPoNo: 'CustomerPoNo',
    commercialInvoiceNo: 'CommercialInvoiceNo',
    taxInvoiceNo: 'TaxInvoiceNo',
    invoiceDate: 'InvoiceDate',
    dueDate: 'DueDate',
    subtotalAmount: 'SubtotalAmount',
    vatAmount: 'VatAmount',
    netReceivable: 'NetReceivable',
    currencyCode: 'CurrencyCode',
    totalAmount: 'TotalAmount',
    ownerName: 'OwnerName',
    lineCount: 'LineCount',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'CustomerPoNo', 'CommercialInvoiceNo', 'TaxInvoiceNo'],
  sortable: {
    docNo: 'DocNo',
    invoiceDate: 'InvoiceDate',
    dueDate: 'DueDate',
    status: 'Status',
    totalAmount: 'TotalAmount',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const ariCreate = z
  .object({
    title: z.string().trim().min(2).max(200),
    bpId: z.string().uuid(),
    invoiceKind: z.enum(['INVOICE', 'CREDIT_MEMO', 'DEBIT_MEMO']).default('INVOICE'),
    customerPoNo: z.string().trim().max(100).nullable().optional(),
    commercialInvoiceNo: z.string().trim().max(30).nullable().optional(),
    taxInvoiceNo: z.string().trim().max(30).nullable().optional(),
    invoiceDate: isoDate,
    dueDate: isoDate.nullable().optional(),
    currencyCode: z.string().trim().length(3).default('IDR'),
    remarks: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z.object({
          itemId: z.coerce.number().int().positive().nullable().optional(),
          description: z.string().trim().min(1).max(500),
          uomId: z.coerce.number().int().positive().nullable().optional(),
          revenueCoaId: z.coerce.number().int().positive().nullable().optional(),
          quantity: posDec,
          unitPrice: dec,
          discountPercent: dec.default(0),
        })
      )
      .min(1, 'At least 1 AR invoice line is required')
      .max(100),
  })
  .strict()

export type CaCreate = z.infer<typeof caCreate>
export type StlCreate = z.infer<typeof stlCreate>
export type RmbCreate = z.infer<typeof rmbCreate>
export type InvCreate = z.infer<typeof invCreate>
export type PayCreate = z.infer<typeof payCreate>
export type PayMufgAction = z.infer<typeof payMufgAction>
export type PayInstallments = z.infer<typeof payInstallments>
export type AriCreate = z.infer<typeof ariCreate>
