import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { taxCodeDef } from './tax-code.schema'

/** SQL only. */
export class TaxCodeRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, taxCodeDef) }
  /** dates as text so the period rule compares calendar days, not JS Dates */
  async period(id: number) {
    return (await this.q.query<{ f: string; t: string | null }>(`SELECT "EffectiveFrom"::text f, "EffectiveTo"::text t FROM mst_tax_code WHERE "Id"=$1`, [id]))[0]
  }
}
