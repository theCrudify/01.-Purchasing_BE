import type { Queryable } from '../../core/db'
import { runList } from '../../core/list-query'
import { employeeList, type EmployeeListQuery } from './employee.schema'

const COLS = Object.entries(employeeList.select).map(([k, c]) => `"${c}" AS "${k}"`).join(',')
const MAP: Record<string, string> = { employeeNo: 'EmployeeNo', departmentId: 'DepartmentId', jobTitle: 'JobTitle', superiorUserId: 'SuperiorUserId', joinDate: 'JoinDate', endDate: 'EndDate', endReason: 'EndReason', isActive: 'IsActive' }

/** SQL only. */
export class EmployeeRepository {
  constructor(private q: Queryable) {}
  list(qs: EmployeeListQuery) {
    const where: string[] = [], params: unknown[] = []
    if (qs.departmentId) { params.push(qs.departmentId); where.push(`t."DepartmentId" = $${params.length}`) }
    if (qs.isActive) { params.push(qs.isActive === 'true'); where.push(`t."IsActive" = $${params.length}`) }
    return runList(this.q, employeeList, qs, { where, params })
  }
  async get(publicId: string) { return (await this.q.query(`SELECT ${COLS} FROM v_employee_list WHERE "PublicId"=$1`, [publicId]))[0] }
  async internalUserId(publicId: string) {
    return (await this.q.query<{ Id: number }>(`SELECT "Id" FROM mst_user WHERE "PublicId"=$1 AND "UserType"='INTERNAL'`, [publicId]))[0]?.Id
  }
  async isEmployee(userId: number) { return (await this.q.query(`SELECT 1 FROM mst_employee WHERE "UserId"=$1`, [userId])).length > 0 }
  async departmentActive(id: number) { return (await this.q.query(`SELECT 1 FROM mst_department WHERE "Id"=$1 AND "IsActive" AND NOT "IsDeleted"`, [id])).length > 0 }
  /** true if `superiorId` is `userId` or reports (transitively) to it */
  async wouldCycle(userId: number, superiorId: number) {
    return !!(await this.q.query<{ hit: boolean }>(
      `WITH RECURSIVE up AS (SELECT "UserId","SuperiorUserId" FROM mst_employee WHERE "UserId"=$2
         UNION SELECT e."UserId", e."SuperiorUserId" FROM mst_employee e JOIN up ON e."UserId"=up."SuperiorUserId")
       SELECT EXISTS (SELECT 1 FROM up WHERE "UserId"=$1) AS hit`, [userId, superiorId]))[0]?.hit
  }
  async insert(userId: number, d: Record<string, unknown>, actorId: number) {
    const pairs = Object.entries(d).filter(([k, v]) => MAP[k] && v !== undefined).map(([k, v]) => [MAP[k]!, v] as const)
    const cols = ['UserId', ...pairs.map(([c]) => c), 'CreatedBy', 'UpdatedBy']
    const vals = [userId, ...pairs.map(([, v]) => v), actorId, actorId]
    await this.q.query(`INSERT INTO mst_employee (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')})`, vals)
  }
  async update(userId: number, d: Record<string, unknown>, actorId: number) {
    const pairs = Object.entries(d).filter(([k, v]) => MAP[k] && v !== undefined).map(([k, v]) => [MAP[k]!, v] as const)
    if (!pairs.length) return true
    const r = await this.q.query(`UPDATE mst_employee SET ${pairs.map(([c], i) => `"${c}"=$${i + 2}`).join(',')},"UpdatedBy"=$${pairs.length + 2} WHERE "UserId"=$1 RETURNING 1`,
      [userId, ...pairs.map(([, v]) => v), actorId])
    return r.length > 0
  }
}
