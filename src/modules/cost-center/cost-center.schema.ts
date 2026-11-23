import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, optId, text } from '../_master/shared'

export const costCenterDef: CrudDef = {
  name: 'Cost center',
  table: 'mst_cost_center',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', departmentId: 'DepartmentId', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', isActive: 'IsActive', updatedAt: 'UpdatedAt' },
  defaultSort: 'code:asc',
  softDelete: true,
  filters: { departmentId: 'DepartmentId' },
}
export const costCenterCreate = z.object({ code: code(20), name: text(150), departmentId: optId, isActive: z.boolean().optional() })
