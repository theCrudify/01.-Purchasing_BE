import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { rule } from '../_master/shared'
import { CostCenterRepository } from './cost-center.repository'
import { costCenterDef } from './cost-center.schema'

const checkDept = async (repo: CostCenterRepository, d: Record<string, unknown>) => {
  if ('departmentId' in d && !(await repo.usable('mst_department', d.departmentId))) throw rule('Department is not active')
}
export class CostCenterService extends CrudService<CostCenterRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new CostCenterRepository(q), costCenterDef, { beforeCreate: (r, d) => checkDept(r, d), beforeUpdate: (r, _k, d) => checkDept(r, d) })
  }
}
