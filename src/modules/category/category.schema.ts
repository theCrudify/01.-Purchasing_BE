import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, optId, text, type ViewDef } from '../_master/shared'

export const categoryDef: CrudDef = {
  name: 'Category',
  table: 'mst_category',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', parentId: 'ParentId', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', isActive: 'IsActive', updatedAt: 'UpdatedAt' },
  defaultSort: 'code:asc',
  softDelete: true,
  filters: { parentId: 'ParentId' },
}
export const categoryView: ViewDef = { table: 'vw_category', fields: { parentCode: 'ParentCode' }, sortable: { parentCode: 'ParentCode' } }

export const categoryCreate = z.object({ code: code(30), name: text(150), parentId: optId, isActive: z.boolean().optional() })
