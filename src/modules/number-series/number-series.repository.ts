import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { numberSeriesDef } from './number-series.schema'

/** SQL only. */
export class NumberSeriesRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, numberSeriesDef) }
}
