import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { BankRepository } from './bank.repository'
import { bankDef } from './bank.schema'

/** Rules live in zod (bank.schema.ts) and DB constraints; no extra hooks needed. */
export class BankService extends CrudService<BankRepository> {
  constructor(db: Db, actor: Actor) { super(db, actor, (q) => new BankRepository(q), bankDef) }
}
