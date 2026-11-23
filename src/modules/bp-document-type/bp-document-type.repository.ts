import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { bpDocumentTypeDef } from './bp-document-type.schema'

/** SQL only. */
export class BpDocumentTypeRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, bpDocumentTypeDef) }
}
