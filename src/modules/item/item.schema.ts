import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, dec, id, optId, optText, text, type ViewDef } from '../_master/shared'

export const itemDef: CrudDef = {
  name: 'Item',
  table: 'mst_item',
  key: { col: 'Id', type: 'int' },
  fields: {
    id: 'Id', code: 'Code', name: 'Name', description: 'Description', itemType: 'ItemType', categoryId: 'CategoryId', uomId: 'UomId',
    purchaseUomId: 'PurchaseUomId', packSize: 'PackSize', vatTaxCodeId: 'VatTaxCodeId', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt',
  },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', itemType: 'ItemType', isActive: 'IsActive', updatedAt: 'UpdatedAt' },
  defaultSort: 'code:asc',
  softDelete: true,
  filters: { categoryId: 'CategoryId', itemType: 'ItemType', uomId: 'UomId' },
}
export const itemView: ViewDef = {
  table: 'vw_item',
  fields: { categoryCode: 'CategoryCode', categoryName: 'CategoryName', uomCode: 'UomCode', purchaseUomCode: 'PurchaseUomCode', vatTaxCode: 'VatTaxCode' },
  sortable: { categoryName: 'CategoryName', uomCode: 'UomCode' },
}

export const itemCreate = z.object({
  code: code(30),
  name: text(200),
  description: optText(1000),
  itemType: z.enum(['GOODS', 'SERVICE']),
  categoryId: id,
  uomId: id,
  purchaseUomId: optId,
  packSize: dec(12, 6, { gt: 0 }).nullable().optional(), // inventory units per purchase unit
  vatTaxCodeId: optId,
  isActive: z.boolean().optional(),
})
