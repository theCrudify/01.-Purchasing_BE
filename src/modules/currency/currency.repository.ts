import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { currencyDef } from './currency.schema'

/** SQL only. */
export class CurrencyRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, currencyDef) }
  async usedByOpenDocuments(code: string) {
    return (await this.q.query(`SELECT 1 FROM tr_document WHERE "CurrencyCode"=$1 AND NOT "IsDeleted" AND "Status" NOT IN ('CLOSED','CANCELLED','REJECTED') LIMIT 1`, [code])).length > 0
  }
}
