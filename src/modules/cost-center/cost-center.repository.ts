import type { Queryable } from '../../core/db'
import { ViewCrudRepository } from '../_master/shared'
import { costCenterDef } from './cost-center.schema'

/** SQL only. */
export class CostCenterRepository extends ViewCrudRepository {
  constructor(q: Queryable) { super(q, costCenterDef, { table: 'mst_cost_center', fields: {} }) }
}
