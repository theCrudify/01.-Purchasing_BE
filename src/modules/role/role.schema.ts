import { z } from 'zod'
import type { CrudDef } from '../../core/crud'

export const roleDef: CrudDef = {
  name: 'Role',
  table: 'mst_role',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', scope: 'Scope', description: 'Description', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', scope: 'Scope', isActive: 'IsActive', updatedAt: 'UpdatedAt' },
  defaultSort: 'code:asc',
  softDelete: true,
  filters: { scope: 'Scope' },
}

export const roleCreate = z.object({
  code: z.string().trim().toUpperCase().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'letters, digits, _ only'),
  name: z.string().trim().min(1).max(100),
  scope: z.enum(['INTERNAL', 'BP', 'SYSTEM']),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
})
/** Code and scope are fixed once created (users are assigned by scope). */
export const roleUpdate = roleCreate.omit({ code: true, scope: true }).partial().strict().refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export const rolePermissions = z.object({ permissionIds: z.array(z.number().int().positive()).max(500) }).strict()
export const roleKey = z.object({ key: z.coerce.number().int().positive() })
