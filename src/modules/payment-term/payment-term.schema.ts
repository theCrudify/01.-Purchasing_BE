import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, text } from '../_master/shared'

export const paymentTermDef: CrudDef = {
  name: 'Payment term',
  table: 'mst_payment_term',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', dueDays: 'DueDays', baselineDate: 'BaselineDate', isActive: 'IsActive', isDeleted: 'IsDeleted' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', dueDays: 'DueDays', isActive: 'IsActive' },
  defaultSort: 'dueDays:asc',
  softDelete: true,
  audit: false,
  hasUpdatedAt: false,
  filters: { baselineDate: 'BaselineDate' },
}

export const paymentTermCreate = z.object({
  code: code(20),
  name: text(100),
  dueDays: z.number().int().min(0).max(3650),
  baselineDate: z.enum(['INVOICE_DATE', 'RECEIPT_DATE']).optional(),
  isActive: z.boolean().optional(),
})
