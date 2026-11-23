import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { isoDate } from '../_master/shared'

export const WF_DOC_TYPES = ['SVR', 'PR', 'RFQ', 'QUO', 'CTR', 'PO', 'GR'] as const
export const APPROVER_TYPES = ['USER', 'ROLE', 'REQUESTER_PICK', 'PREPARER_MAPPING', 'PREPARER_MAPPING_PICK', 'SUPERIOR', 'DEPARTMENT_HEAD', 'BP_PIC'] as const
export const STEP_CODES = ['CH', 'AC', 'AP', 'RE', 'CL'] as const

// ---- inbox / history (vw_wf_task)
export const taskList: ListConfig = {
  table: 'vw_wf_task',
  select: {
    id: 'PublicId', status: 'Status', stepNo: 'StepNo', stepName: 'StepName', assigneeName: 'AssigneeName', actedByName: 'ActedByName', actingAs: 'ActingAs',
    actedAt: 'ActedAt', remarks: 'Remarks', roundNo: 'RoundNo', startedAt: 'StartedAt', documentId: 'DocumentPublicId', docType: 'DocType', docNo: 'DocNo',
    title: 'Title', docStatus: 'DocStatus', docDate: 'DocDate', currencyCode: 'CurrencyCode', totalAmount: 'TotalAmount', totalAmountBase: 'TotalAmountBase', ownerName: 'OwnerName',
  },
  searchable: ['DocNo', 'Title', 'OwnerName'],
  sortable: { startedAt: 'StartedAt', actedAt: 'ActedAt', docNo: 'DocNo', docType: 'DocType', totalAmountBase: 'TotalAmountBase' },
  defaultSort: 'startedAt:asc',
  tiebreaker: 'Id',
}
export const taskListQuery = listQuerySchema.extend({ docType: z.enum(WF_DOC_TYPES).optional() })
export const taskParam = z.object({ taskId: z.string().uuid() })
export const decideBody = z.object({ decision: z.enum(['APPROVE', 'REJECT', 'RETURN']), remarks: z.string().trim().max(1000).optional() }).strict()
export type TaskListQuery = z.infer<typeof taskListQuery>

// ---- configuration
export const templateDef: CrudDef = {
  name: 'Approval template', table: 'mst_approval_template', key: { col: 'Id', type: 'int' },
  fields: {
    id: 'Id', code: 'Code', name: 'Name', docType: 'DocType', priority: 'Priority', minAmountBase: 'MinAmountBase', maxAmountBase: 'MaxAmountBase',
    departmentId: 'DepartmentId', purchaseClassId: 'PurchaseClassId', effectiveFrom: 'EffectiveFrom', effectiveTo: 'EffectiveTo', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt',
  },
  searchable: ['Code', 'Name'], sortable: { code: 'Code', name: 'Name', docType: 'DocType', priority: 'Priority', isActive: 'IsActive' },
  defaultSort: 'docType:asc,priority:asc', softDelete: true, filters: { docType: 'DocType' },
}
const money = z.string().regex(/^\d{1,17}(\.\d{1,2})?$/, 'amount with max 2 decimals')
export const templateCreate = z.object({
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/), name: z.string().trim().min(1).max(150), docType: z.enum(WF_DOC_TYPES),
  priority: z.number().int().min(0).max(32000).optional(), minAmountBase: money.nullable().optional(), maxAmountBase: money.nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(), purchaseClassId: z.number().int().positive().nullable().optional(),
  effectiveFrom: isoDate, effectiveTo: isoDate.nullable().optional(), isActive: z.boolean().optional(),
})
export const stepsBody = z.object({
  steps: z.array(z.object({
    name: z.string().trim().min(1).max(100), stepCode: z.enum(STEP_CODES).nullable().optional(), approverType: z.enum(APPROVER_TYPES),
    approverUserId: z.string().uuid().nullable().optional(), approverRoleId: z.number().int().positive().nullable().optional(),
    picRole: z.enum(['BUYER', 'INVOICE_RECEIVER', 'ACCOUNT_MANAGER']).nullable().optional(),
    requiredApprovals: z.number().int().min(1).max(10).optional(), isOptional: z.boolean().optional(),
  }).strict()).min(1).max(10),
}).strict()
export type StepsBody = z.infer<typeof stepsBody>

export const mappingList: ListConfig = {
  table: 'vw_wf_approver_mapping',
  select: { id: 'Id', docType: 'DocType', stepCode: 'StepCode', preparerId: 'PreparerPublicId', preparerName: 'PreparerName', approverId: 'ApproverPublicId', approverName: 'ApproverName', isActive: 'IsActive' },
  searchable: ['PreparerName', 'ApproverName'], sortable: { preparerName: 'PreparerName', approverName: 'ApproverName', docType: 'DocType', stepCode: 'StepCode' },
  defaultSort: 'preparerName:asc', tiebreaker: 'Id',
}
export const mappingCreate = z.object({ preparerId: z.string().uuid(), approverId: z.string().uuid(), docType: z.enum(WF_DOC_TYPES), stepCode: z.enum(STEP_CODES) }).strict()

export const backupList: ListConfig = {
  table: 'vw_wf_approval_backup',
  select: { id: 'Id', approverId: 'ApproverPublicId', approverName: 'ApproverName', backupId: 'BackupPublicId', backupName: 'BackupName', notes: 'Notes', isActive: 'IsActive' },
  searchable: ['ApproverName', 'BackupName'], sortable: { approverName: 'ApproverName', backupName: 'BackupName' }, defaultSort: 'approverName:asc', tiebreaker: 'Id',
}
export const backupCreate = z.object({ approverId: z.string().uuid(), backupId: z.string().uuid(), notes: z.string().trim().max(500).nullable().optional() }).strict()

export const delegationList: ListConfig = {
  table: 'vw_wf_delegation',
  select: { id: 'Id', fromId: 'FromPublicId', fromName: 'FromName', toId: 'ToPublicId', toName: 'ToName', docType: 'DocType', docNo: 'DocNo', startsAt: 'StartsAt', endsAt: 'EndsAt', reason: 'Reason', revokedAt: 'RevokedAt', isCurrent: 'IsCurrent' },
  searchable: ['FromName', 'ToName', 'Reason'], sortable: { startsAt: 'StartsAt', endsAt: 'EndsAt', fromName: 'FromName' }, defaultSort: 'startsAt:desc', tiebreaker: 'Id',
}
export const delegationCreate = z.object({
  fromId: z.string().uuid().optional(), // default: me; someone else needs APPROVAL.CONFIG
  toId: z.string().uuid(), docType: z.enum(WF_DOC_TYPES).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }), reason: z.string().trim().max(300).optional(),
}).strict().refine((v) => v.endsAt > v.startsAt, 'End must be after start')
export const idParam = z.object({ id: z.coerce.number().int().positive() })
export const configListQuery = listQuerySchema.extend({ docType: z.enum(WF_DOC_TYPES).optional(), mine: z.enum(['true']).optional() })
export type ConfigListQuery = z.infer<typeof configListQuery>
