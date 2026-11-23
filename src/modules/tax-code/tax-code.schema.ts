import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, dec, isoDate, text } from '../_master/shared'

export const taxCodeDef: CrudDef = {
  name: 'Tax code',
  table: 'mst_tax_code',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', taxType: 'TaxType', ratePercent: 'RatePercent', effectiveFrom: 'EffectiveFrom', effectiveTo: 'EffectiveTo', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', taxType: 'TaxType', ratePercent: 'RatePercent', effectiveFrom: 'EffectiveFrom', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: true,
  filters: { taxType: 'TaxType' },
}

/** VAT = PPN, WHT = PPh (23, 4(2), 22, 26…). */
export const taxCodeCreate = z.object({
  code: code(20),
  name: text(100),
  taxType: z.enum(['VAT', 'WHT']),
  ratePercent: dec(3, 4, { min: 0, max: 100 }),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  isActive: z.boolean().optional(),
})
