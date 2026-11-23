import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { notFound } from '../../core/errors'
import { rule } from '../_master/shared'
import { EmployeeRepository } from './employee.repository'
import type { EmployeeCreate, EmployeeListQuery, EmployeeUpdate } from './employee.schema'

/** Employee record of an INTERNAL user: department, superior (approval chain), effective dates. */
export class EmployeeService {
  constructor(private db: Db, private actor: Actor) {}
  private run<T>(fn: (r: EmployeeRepository) => Promise<T>) { return this.db.session(this.actor, (q) => fn(new EmployeeRepository(q))) }

  list(qs: EmployeeListQuery) { return this.run((r) => r.list(qs)) }
  get(id: string) { return this.run(async (r) => (await r.get(id)) ?? Promise.reject(notFound('Employee'))) }

  private async resolve(r: EmployeeRepository, userId: number, d: EmployeeUpdate) {
    const out: Record<string, unknown> = { ...d }
    if (d.departmentId !== undefined && !(await r.departmentActive(d.departmentId))) throw rule('Department is not active')
    if (d.superiorId !== undefined) {
      const sup = d.superiorId === null ? null : await r.internalUserId(d.superiorId)
      if (d.superiorId && !sup) throw rule('Superior must be an internal user')
      if (sup && (sup === userId || (await r.wouldCycle(userId, sup)))) throw rule('Superior would create a reporting cycle')
      out.superiorUserId = sup
    }
    if (d.endDate && d.joinDate && d.endDate < d.joinDate) throw rule('End date is before join date')
    if (d.endDate && !d.endReason) throw rule('End reason is required with an end date')
    return out
  }

  create(d: EmployeeCreate) {
    return this.run(async (r) => {
      const userId = await r.internalUserId(d.userId)
      if (!userId) throw rule('User must be an internal user')
      const { userId: _u, ...rest } = d
      await r.insert(userId, await this.resolve(r, userId, rest), this.actor.id)
      return r.get(d.userId)
    })
  }

  update(id: string, d: EmployeeUpdate) {
    return this.run(async (r) => {
      const userId = await r.internalUserId(id)
      if (!userId || !(await r.update(userId, await this.resolve(r, userId, d), this.actor.id))) throw notFound('Employee')
      return r.get(id)
    })
  }
}
