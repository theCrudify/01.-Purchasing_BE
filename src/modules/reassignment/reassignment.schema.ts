import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'

export const reassignmentList: ListConfig = {
  table: 'vw_wf_reassignment',
  select: { id: 'PublicId', status: 'Status', reason: 'Reason', remarks: 'Remarks', requestedAt: 'RequestedAt', decidedAt: 'DecidedAt', decisionRemarks: 'DecisionRemarks',
    fromName: 'FromName', toName: 'ToName', approverName: 'ApproverName', requestedByName: 'RequestedByName', taskCount: 'TaskCount' },
  searchable: ['FromName', 'ToName', 'Remarks'],
  sortable: { requestedAt: 'RequestedAt', status: 'Status' },
  defaultSort: 'requestedAt:desc',
  tiebreaker: 'Id',
}
export const reassignmentListQuery = listQuerySchema.extend({ box: z.enum(['to-decide', 'mine', 'all']).default('mine'), status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional() })
export const reassignmentCreate = z.object({
  fromId: z.string().uuid(), toId: z.string().uuid(), approverId: z.string().uuid(),
  reason: z.enum(['RESIGNED', 'TRANSFERRED', 'LEAVE', 'WORKLOAD', 'WRONG_ASSIGNEE', 'OTHER']), remarks: z.string().trim().min(3).max(1000),
  taskIds: z.array(z.string().uuid()).max(500).optional(), // default: every open task of fromId
}).strict()
export const reassignmentDecide = z.object({ decision: z.enum(['APPROVE', 'REJECT']), remarks: z.string().trim().max(1000).optional() }).strict()
export const reassignmentParam = z.object({ id: z.string().uuid() })
export type ReassignmentCreate = z.infer<typeof reassignmentCreate>
export type ReassignmentListQuery = z.infer<typeof reassignmentListQuery>
