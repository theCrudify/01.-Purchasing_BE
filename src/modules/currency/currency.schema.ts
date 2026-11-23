import { z } from 'zod'
import type { CrudDef } from '../../core/crud'

/** 178 ISO 4217 rows are seeded; Finance only activates them and sets the display symbol. */
export const currencyDef: CrudDef = {
  name: 'Currency',
  table: 'mst_currency',
  key: { col: 'Code', type: 'code' },
  pk: 'Code',
  fields: { code: 'Code', numericCode: 'NumericCode', name: 'Name', symbol: 'Symbol', decimals: 'Decimals', isFund: 'IsFund', isActive: 'IsActive' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: false,
  audit: false,
  hasUpdatedAt: false,
}
export const currencyUpdate = z.object({ symbol: z.string().trim().max(10).nullable().optional(), isActive: z.boolean().optional() })
  .strict().refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export const currencyKey = z.object({ key: z.string().trim().length(3).transform((s) => s.toUpperCase()) })
