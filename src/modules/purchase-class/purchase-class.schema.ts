import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, dec, text } from '../_master/shared'

export const purchaseClassDef: CrudDef = {
  name: 'Purchase class',
  table: 'mst_purchase_class',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', isAsset: 'IsAsset', invoicePriceTolerancePct: 'InvoicePriceTolerancePct', isActive: 'IsActive', isDeleted: 'IsDeleted' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', isAsset: 'IsAsset', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: true,
  audit: false,
  hasUpdatedAt: false,
  filters: { isAsset: 'IsAsset' },
}

export const purchaseClassCreate = z.object({
  code: code(20),
  name: text(100),
  isAsset: z.boolean().optional(),
  invoicePriceTolerancePct: dec(3, 4, { min: 0, max: 100 }).optional(), // % deviation allowed invoice vs PO unit price
  isActive: z.boolean().optional(),
})
