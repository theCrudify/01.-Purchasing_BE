import type { Queryable } from '../../core/db'
import { ViewCrudRepository } from '../_master/shared'
import { itemDef, itemView } from './item.schema'

/** SQL only. List/get read vw_item (category / UoM / tax names). */
export class ItemRepository extends ViewCrudRepository {
  constructor(q: Queryable) { super(q, itemDef, itemView) }
}
