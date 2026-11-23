import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { uomDef } from './uom.schema'

export class UomRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, uomDef) }
  async usedByActiveItem(id: number) {
    return (await this.q.query(`SELECT 1 FROM mst_item WHERE ("UomId"=$1 OR "PurchaseUomId"=$1) AND NOT "IsDeleted" LIMIT 1`, [id])).length > 0
  }
}
