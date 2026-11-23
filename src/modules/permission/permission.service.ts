import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import type { ListQuery } from '../../core/list-query'
import { PermissionRepository } from './permission.repository'

export class PermissionService {
  constructor(private db: Db, private actor: Actor) {}
  list(qs: ListQuery & { module?: string }) { return this.db.session(this.actor, (q) => new PermissionRepository(q).list(qs)) }
  grouped() { return this.db.session(this.actor, (q) => new PermissionRepository(q).grouped()) }
}
