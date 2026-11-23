import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { PurchaseClassRepository } from './purchase-class.repository'
import { purchaseClassDef } from './purchase-class.schema'

/** Rules live in zod (purchase-class.schema.ts) and DB constraints; no extra hooks needed. */
export class PurchaseClassService extends CrudService<PurchaseClassRepository> {
  constructor(db: Db, actor: Actor) { super(db, actor, (q) => new PurchaseClassRepository(q), purchaseClassDef) }
}
