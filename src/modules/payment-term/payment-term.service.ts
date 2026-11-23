import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { PaymentTermRepository } from './payment-term.repository'
import { paymentTermDef } from './payment-term.schema'

/** Rules live in zod (payment-term.schema.ts) and DB constraints; no extra hooks needed. */
export class PaymentTermService extends CrudService<PaymentTermRepository> {
  constructor(db: Db, actor: Actor) { super(db, actor, (q) => new PaymentTermRepository(q), paymentTermDef) }
}
