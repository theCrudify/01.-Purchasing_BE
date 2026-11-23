import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, text } from '../_master/shared'

export const uomDef: CrudDef = {
  name: 'UoM',
  table: 'mst_uom',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', isActive: 'IsActive', isDeleted: 'IsDeleted' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: true,
  audit: false,
  hasUpdatedAt: false,
}

export const uomCreate = z.object({ code: code(10), name: text(50), isActive: z.boolean().optional() })
