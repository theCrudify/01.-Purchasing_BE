import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { isoDate } from '../_master/shared'

export const handoverList: ListConfig = {
  table: 'vw_wf_handover',
  select: { id: 'Id', reason: 'Reason', effectiveDate: 'EffectiveDate', status: 'Status', remarks: 'Remarks', executedAt: 'ExecutedAt', executedByName: 'ExecutedByName',
    fromName: 'FromName', toName: 'ToName', documentsTransferred: 'DocumentsTransferred', mappingsTransferred: 'MappingsTransferred',
    picRolesTransferred: 'PicRolesTransferred', orgRolesTransferred: 'OrgRolesTransferred' },
  searchable: ['FromName', 'ToName', 'Remarks'],
  sortable: { executedAt: 'ExecutedAt', effectiveDate: 'EffectiveDate' },
  defaultSort: 'executedAt:desc',
  tiebreaker: 'Id',
}
export const handoverListQuery = listQuerySchema
export const handoverCreate = z.object({
  fromId: z.string().uuid(), toId: z.string().uuid(),
  reason: z.enum(['RESIGNED', 'TERMINATED', 'RETIRED', 'TRANSFERRED', 'LEAVE']), effectiveDate: isoDate,
  remarks: z.string().trim().max(1000).optional(),
  approverId: z.string().uuid().optional(), // superior who approves moving the open approval tasks (required when there are any)
}).strict()
export const handoverParam = z.object({ id: z.coerce.number().int().positive() })
export type HandoverCreate = z.infer<typeof handoverCreate>
