import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'

export const DOC_TYPES = ['SVR', 'PR', 'RFQ', 'QUO', 'PO', 'CTR', 'GR', 'INV', 'PAY', 'CA', 'STL', 'RMB', 'ARI', 'RCV'] as const
/** Document types a BP portal user may ever see (when the document belongs to one of their BPs). */
export const PORTAL_DOC_TYPES = new Set(['SVR', 'QUO', 'PO', 'CTR', 'GR', 'INV', 'PAY', 'ARI', 'RCV'])
/** Statuses in which a document may be soft-deleted (CK_tr_document_SoftDelete). */
export const DELETABLE_STATUSES = new Set(['DRAFT', 'CANCELLED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED', 'NOT_AWARDED'])
export const EDITABLE_STATUSES = new Set(['DRAFT', 'RETURNED', 'REVISION_REQUIRED'])
export const ATTACHMENT_CATEGORIES = ['SPECIFICATION', 'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'DELIVERY_NOTE', 'BAST', 'QC_REPORT', 'PAYMENT_PROOF', 'CONTRACT', 'OTHER'] as const

export const deletedListConfig: ListConfig = {
  table: 'vw_wf_document',
  select: { id: 'PublicId', docType: 'DocType', docNo: 'DocNo', docDate: 'DocDate', status: 'Status', title: 'Title', ownerName: 'OwnerName',
    currencyCode: 'CurrencyCode', totalAmount: 'TotalAmount', deletedAt: 'DeletedAt', deletedByName: 'DeletedByName', deleteReason: 'DeleteReason' },
  searchable: ['DocNo', 'Title', 'OwnerName'],
  sortable: { docNo: 'DocNo', docDate: 'DocDate', deletedAt: 'DeletedAt', docType: 'DocType', status: 'Status' },
  defaultSort: 'deletedAt:desc',
  tiebreaker: 'Id',
}

export const docParam = z.object({ publicId: z.string().uuid() })
export const attParam = docParam.extend({ attId: z.string().uuid() })
export const deletedQuery = listQuerySchema.extend({ docType: z.enum(DOC_TYPES).optional() })
export const reasonBody = z.object({ reason: z.string().trim().min(3).max(500) }).strict()
export const commentBody = z.object({ body: z.string().trim().min(1).max(4000), visibility: z.enum(['SHARED', 'INTERNAL']).optional() }).strict()
export const attachmentForm = z.object({
  file: z.instanceof(File),
  category: z.enum(ATTACHMENT_CATEGORIES).default('OTHER'),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(['SHARED', 'INTERNAL']).default('SHARED'),
})
