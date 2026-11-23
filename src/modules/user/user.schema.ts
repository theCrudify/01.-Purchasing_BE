import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'

export const USER_STATUSES = ['PENDING_ACTIVATION', 'ACTIVE', 'LOCKED', 'DISABLED', 'REJECTED'] as const

export const userList: ListConfig = {
  table: 'v_user_list',
  select: { id: 'PublicId', email: 'Email', displayName: 'DisplayName', phone: 'Phone', userType: 'UserType', status: 'Status', statusReason: 'StatusReason',
    lastLoginAt: 'LastLoginAt', createdAt: 'CreatedAt', employeeNo: 'EmployeeNo', departmentName: 'DepartmentName', roles: 'Roles' },
  searchable: ['Email', 'DisplayName', 'EmployeeNo'],
  sortable: { email: 'Email', displayName: 'DisplayName', status: 'Status', userType: 'UserType', lastLoginAt: 'LastLoginAt', createdAt: 'CreatedAt' },
  defaultSort: 'displayName:asc',
  tiebreaker: 'Id',
}
export const userListQuery = listQuerySchema.extend({
  userType: z.enum(['INTERNAL', 'BP', 'SYSTEM']).optional(),
  status: z.enum(USER_STATUSES).optional(),
  roleId: z.coerce.number().int().positive().optional(),
})
export type UserListQuery = z.infer<typeof userListQuery>

/** Small lookup for pickers (superior, approver…): any internal user may read names. */
export const userLookupList: ListConfig = {
  table: 'v_user_list',
  select: { id: 'PublicId', email: 'Email', displayName: 'DisplayName', userType: 'UserType', employeeNo: 'EmployeeNo' },
  searchable: ['Email', 'DisplayName', 'EmployeeNo'],
  sortable: { displayName: 'DisplayName', email: 'Email' },
  defaultSort: 'displayName:asc',
  tiebreaker: 'Id',
}
export const userLookupQuery = listQuerySchema.extend({ userType: z.enum(['INTERNAL', 'BP']).optional(), employees: z.enum(['true']).optional() })

export const sessionList: ListConfig = {
  table: 'v_user_session_list',
  select: { id: 'PublicId', authMethod: 'AuthMethod', ipAddress: 'IpAddress', userAgent: 'UserAgent', startedAt: 'StartedAt', lastSeenAt: 'LastSeenAt',
    expiresAt: 'ExpiresAt', endedAt: 'EndedAt', endReason: 'EndReason', endedByEmail: 'EndedByEmail', isActive: 'IsActive', email: 'Email', userId: 'UserPublicId' },
  searchable: ['IpAddress', 'UserAgent'],
  sortable: { startedAt: 'StartedAt', lastSeenAt: 'LastSeenAt', endedAt: 'EndedAt' },
  defaultSort: 'startedAt:desc',
  tiebreaker: 'Id',
}
export const sessionListQuery = listQuerySchema.extend({ active: z.enum(['true', 'false']).optional() })

export const idParam = z.object({ id: z.string().uuid() })
const name = z.string().trim().min(1).max(150)
const phone = z.string().trim().max(30).regex(/^[+0-9 ()-]*$/, 'digits, spaces, + - ( ) only').nullable().optional()
const roleIds = z.array(z.number().int().positive()).max(50)

export const userCreate = z.object({ email: z.string().trim().toLowerCase().email().max(254), displayName: name, phone, roleIds: roleIds.optional() }).strict()
export const userUpdate = z.object({ displayName: name.optional(), phone }).strict().refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export const userRoles = z.object({ roleIds }).strict()
export const userDisable = z.object({ reason: z.string().trim().max(500).optional() }).strict()
export type UserCreate = z.infer<typeof userCreate>
export type UserUpdate = z.infer<typeof userUpdate>
