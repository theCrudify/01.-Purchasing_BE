import { z } from 'zod'
import type { CrudDef } from '../../core/crud'

export const departmentDef: CrudDef = {
  name: 'Department',
  table: 'mst_department',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', parentId: 'ParentId', headUserId: 'HeadUserId', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt' },
  searchable: ['Code', 'Name'], // pg_trgm indexes in db/migrations
  sortable: { code: 'Code', name: 'Name', updatedAt: 'UpdatedAt', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: true,
  filters: { parentId: 'ParentId' },
}

export const departmentCreate = z.object({
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, - _ only'),
  name: z.string().trim().min(1).max(150),
  parentId: z.number().int().positive().nullable().optional(),
  headUserId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})
export type DepartmentCreate = z.infer<typeof departmentCreate>
