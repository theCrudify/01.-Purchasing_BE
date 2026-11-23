import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { BpDocumentTypeRepository } from './bp-document-type.repository'
import { bpDocumentTypeDef } from './bp-document-type.schema'

/** Rules live in zod (bp-document-type.schema.ts) and DB constraints; no extra hooks needed. */
export class BpDocumentTypeService extends CrudService<BpDocumentTypeRepository> {
  constructor(db: Db, actor: Actor) { super(db, actor, (q) => new BpDocumentTypeRepository(q), bpDocumentTypeDef) }
}
