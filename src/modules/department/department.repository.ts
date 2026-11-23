import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { departmentDef } from './department.schema'

export type DepartmentRow = { id: number; code: string; name: string; parentId: number | null; headUserId: number | null; isActive: boolean; isDeleted: boolean; updatedAt: Date }

/** SQL only: no permission checks, no HTTP, no business rules. */
export class DepartmentRepository extends CrudRepository<DepartmentRow> {
  constructor(q: Queryable) { super(q, departmentDef) }

  async hasActiveChildren(id: number) {
    return ((await this.q.query<{ n: number }>(`SELECT count(*)::int AS n FROM mst_department WHERE "ParentId"=$1 AND NOT "IsDeleted"`, [id]))[0]?.n ?? 0) > 0
  }

  /** true when making `parentId` the parent of `id` would create a cycle */
  async wouldCycle(id: number, parentId: number) {
    const r = await this.q.query<{ hit: boolean }>(
      `WITH RECURSIVE up AS (SELECT "Id","ParentId" FROM mst_department WHERE "Id"=$2
         UNION ALL SELECT d."Id", d."ParentId" FROM mst_department d JOIN up ON d."Id"=up."ParentId")
       SELECT EXISTS (SELECT 1 FROM up WHERE "Id"=$1) AS hit`, [id, parentId])
    return !!r[0]?.hit
  }
}
