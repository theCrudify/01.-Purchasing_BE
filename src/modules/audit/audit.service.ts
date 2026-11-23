import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { AuditRepository } from './audit.repository'
import type { AuditKind, AuditListQuery } from './audit.schema'

export class AuditService {
  constructor(private db: Db, private actor: Actor) {}
  list(kind: AuditKind, qs: AuditListQuery) { return this.db.session(this.actor, (q) => new AuditRepository(q).list(kind, qs)) }
}
