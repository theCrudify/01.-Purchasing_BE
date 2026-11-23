import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { conflict } from '../../core/errors'
import { merged, rule } from '../_master/shared'
import { BudgetRepository } from './budget.repository'
import { budgetDef } from './budget.schema'

async function check(repo: BudgetRepository, d: Record<string, any>, changed: Record<string, unknown>, key: number | null) {
  if ('departmentId' in changed && !(await repo.usable('mst_department', d.departmentId))) throw rule('Department is not active')
  if ('purchaseClassId' in changed && !(await repo.usable('mst_purchase_class', d.purchaseClassId))) throw rule('Purchase class is not active')
  // one active budget per year × department × purchase class (NULL class counts as its own slot)
  if (d.isActive !== false && (await repo.duplicate(d, key))) throw conflict('An active budget already exists for this year, department and purchase class')
}

export class BudgetService extends CrudService<BudgetRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new BudgetRepository(q), budgetDef, {
      beforeCreate: (repo, d) => check(repo, d, d, null),
      beforeUpdate: async (repo, key, d) => check(repo, await merged(repo, key, d), d, key as number),
    })
  }
}
