import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { conflict } from '../../core/errors'
import { DepartmentRepository } from './department.repository'
import { departmentDef } from './department.schema'

/** Business rules + transaction boundary. Knows nothing about HTTP. */
export class DepartmentService extends CrudService<DepartmentRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new DepartmentRepository(q), departmentDef, {
      async beforeUpdate(repo, key, data) {
        const parentId = data.parentId as number | null | undefined
        if (parentId != null && (parentId === key || (await repo.wouldCycle(key as number, parentId)))) throw conflict('Parent would create a cycle')
      },
      async beforeDelete(repo, key) {
        if (await repo.hasActiveChildren(key as number)) throw conflict('Department still has active sub-departments')
      },
    })
  }
}
