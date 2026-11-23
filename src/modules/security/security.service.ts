import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { HttpError, notFound } from '../../core/errors'
import { AuthRepository } from '../auth/auth.repository'
import { IpAllowListRepository, SessionAdminRepository } from './security.repository'
import { ipAllowListDef } from './security.schema'

const lockedOut = () => new HttpError(422, 'IP_LOCKOUT', 'This change would block your own IP address from the admin pages')

/** IP allow list CRUD. Every write is checked in the same transaction: the caller must still be allowed afterwards. */
export class IpAllowListService extends CrudService<IpAllowListRepository> {
  constructor(db: Db, actor: Actor, private ip: string | null) { super(db, actor, (q) => new IpAllowListRepository(q), ipAllowListDef) }

  private guarded<T>(fn: (r: IpAllowListRepository) => Promise<T>) {
    return this.run(async (r) => { const out = await fn(r); if (!(await r.allows(this.ip)).ok) throw lockedOut(); return out })
  }
  override create(data: Record<string, unknown>) { return this.guarded((r) => r.create(data, this.actor.id)) }
  override update(key: unknown, data: Record<string, unknown>) { return this.guarded(async (r) => this.found(await r.update(key, data, this.actor.id))) }
  override remove(key: unknown) { return this.guarded(async (r) => this.found(await r.remove(key as number))) }
  check() { return this.run(async (r) => ({ ip: this.ip, ...(await r.allows(this.ip)) })) }
}

export class SessionAdminService {
  constructor(private db: Db, private actor: Actor) {}
  revoke(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const s = await new SessionAdminRepository(q).end(publicId, this.actor.id)
      if (!s) throw notFound('Active session')
      await new AuthRepository(q).logActivity({ userId: s.UserId, sessionId: s.Id, action: 'SESSION_REVOKED', detail: `by ${this.actor.email}` })
      return { ended: 1 }
    })
  }
}
