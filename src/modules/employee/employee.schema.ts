import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { isoDate, optText } from '../_master/shared'

/** Employees are keyed by their user's PublicId (never the numeric id). */
export const employeeList: ListConfig = {
  table: 'v_employee_list',
  select: {
    id: 'PublicId', email: 'Email', displayName: 'DisplayName', employeeNo: 'EmployeeNo', departmentId: 'DepartmentId', departmentName: 'DepartmentName',
    jobTitle: 'JobTitle', superiorId: 'SuperiorPublicId', superiorName: 'SuperiorName', joinDate: 'JoinDate', endDate: 'EndDate', endReason: 'EndReason', isActive: 'IsActive',
  },
  searchable: ['EmployeeNo', 'DisplayName', 'Email', 'JobTitle'],
  sortable: { employeeNo: 'EmployeeNo', displayName: 'DisplayName', departmentName: 'DepartmentName', joinDate: 'JoinDate', isActive: 'IsActive' },
  defaultSort: 'displayName:asc',
  tiebreaker: 'UserId',
}
export const employeeListQuery = listQuerySchema.extend({ departmentId: z.coerce.number().int().positive().optional(), isActive: z.enum(['true', 'false']).optional() })
const body = {
  employeeNo: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9.\/-]+$/).transform((s) => s.toUpperCase()),
  departmentId: z.number().int().positive(),
  jobTitle: optText(100),
  superiorId: z.string().uuid().nullable().optional(), // superior's user PublicId
  joinDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  endReason: z.enum(['RESIGNED', 'TERMINATED', 'RETIRED', 'TRANSFERRED', 'DECEASED']).nullable().optional(),
  isActive: z.boolean().optional(),
}
export const employeeCreate = z.object({ userId: z.string().uuid(), ...body }).strict()
export const employeeUpdate = z.object(body).partial().strict().refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export const employeeKey = z.object({ id: z.string().uuid() })
export type EmployeeListQuery = z.infer<typeof employeeListQuery>
export type EmployeeCreate = z.infer<typeof employeeCreate>
export type EmployeeUpdate = z.infer<typeof employeeUpdate>
