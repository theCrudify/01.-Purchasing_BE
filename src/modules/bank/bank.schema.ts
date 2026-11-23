import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, text } from '../_master/shared'

export const bankDef: CrudDef = {
  name: 'Bank',
  table: 'mst_bank',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', swiftCode: 'SwiftCode', isActive: 'IsActive', isDeleted: 'IsDeleted' },
  searchable: ['Code', 'Name', 'SwiftCode'],
  sortable: { code: 'Code', name: 'Name', swiftCode: 'SwiftCode', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: true,
  audit: false,
  hasUpdatedAt: false,
}

export const bankCreate = z.object({
  code: code(20),
  name: text(150),
  // ISO 9362 BIC: 4 bank + 2 country + 2 location (+ 3 branch)
  swiftCode: z.string().trim().toUpperCase().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'SWIFT/BIC must be 8 or 11 characters').nullable().optional(),
  isActive: z.boolean().optional(),
})
