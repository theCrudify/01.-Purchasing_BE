import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { bankDef } from './bank.schema'

/** SQL only. */
export class BankRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, bankDef) }
}
