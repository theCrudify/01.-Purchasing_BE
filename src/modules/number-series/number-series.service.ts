import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { NumberSeriesRepository } from './number-series.repository'
import { numberSeriesDef } from './number-series.schema'

/** Edit prefix / format only; the counter (LastNumber) is owned by the document core. */
export class NumberSeriesService extends CrudService<NumberSeriesRepository> {
  constructor(db: Db, actor: Actor) { super(db, actor, (q) => new NumberSeriesRepository(q), numberSeriesDef) }
}
