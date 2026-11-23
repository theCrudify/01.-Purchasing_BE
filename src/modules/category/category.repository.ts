import type { Queryable } from '../../core/db'
import { ViewCrudRepository } from '../_master/shared'
import { categoryDef, categoryView } from './category.schema'

/** SQL only. */
export class CategoryRepository extends ViewCrudRepository {
  constructor(q: Queryable) { super(q, categoryDef, categoryView) }

  async inUse(id: number) {
    return (await this.q.query(
      `SELECT 1 FROM mst_category WHERE "ParentId"=$1 AND NOT "IsDeleted"
       UNION ALL SELECT 1 FROM mst_item WHERE "CategoryId"=$1 AND NOT "IsDeleted" LIMIT 1`, [id])).length > 0
  }

  /** true when making `parentId` the parent of `id` would create a cycle */
  async wouldCycle(id: number, parentId: number) {
    const r = await this.q.query<{ hit: boolean }>(
      `WITH RECURSIVE up AS (SELECT "Id","ParentId" FROM mst_category WHERE "Id"=$2
         UNION ALL SELECT c."Id", c."ParentId" FROM mst_category c JOIN up ON c."Id"=up."ParentId")
       SELECT EXISTS (SELECT 1 FROM up WHERE "Id"=$1) AS hit`, [id, parentId])
    return !!r[0]?.hit
  }
}
