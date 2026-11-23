import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { purchaseClassDef } from './purchase-class.schema'

/** SQL only. */
export class PurchaseClassRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, purchaseClassDef) }
}
