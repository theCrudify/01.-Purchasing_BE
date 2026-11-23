import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { paymentTermDef } from './payment-term.schema'

/** SQL only. */
export class PaymentTermRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, paymentTermDef) }
}
