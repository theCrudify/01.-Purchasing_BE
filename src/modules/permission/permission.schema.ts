import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'

export const permissionList: ListConfig = {
  table: 'mst_permission',
  select: { id: 'Id', code: 'Code', module: 'Module', name: 'Name' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', module: 'Module', name: 'Name' },
  defaultSort: 'code:asc',
  tiebreaker: 'Id',
}
export const permissionListQuery = listQuerySchema.extend({ module: z.string().trim().max(30).optional() })
