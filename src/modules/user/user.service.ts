import { hashPassword } from '../../core/password'
import type { Db, Queryable } from '../../core/db'
import type { Actor } from '../../core/types'
import type { Config } from '../../env'
import type { ListQuery } from '../../core/list-query'
import { HttpError, conflict, forbidden, notFound } from '../../core/errors'
import { AuthRepository } from '../auth/auth.repository'
import { newRefreshToken } from '../auth/auth.tokens'
import { INVITE_MIN, issueResetCode, resetMail, type Defer } from '../password-reset/password-reset.service'
import { UserRepository, type UserCore } from './user.repository'
import type { UserCreate, UserListQuery, UserUpdate } from './user.schema'

/** Admin user management. Business rules + transaction boundary; knows nothing about HTTP. */
export class UserService {
  constructor(private db: Db, private actor: Actor, private cfg: Config, private defer: Defer) {}

  private run<T>(fn: (r: UserRepository, q: Queryable) => Promise<T>) { return this.db.session(this.actor, (q) => fn(new UserRepository(q), q)) }
  private async load(r: UserRepository, publicId: string) { const u = await r.core(publicId); if (!u) throw notFound('User'); return u }
  private notSelf(u: UserCore, what: string) { if (u.Id === this.actor.id) throw forbidden(`You cannot ${what} your own account`) }
  private log(q: Queryable, u: UserCore, action: string, detail?: string) {
    return new AuthRepository(q).logActivity({ userId: u.Id, email: u.Email, action, detail: `${detail ? detail + ' ' : ''}by ${this.actor.email}`.slice(0, 500) })
  }

  list(qs: UserListQuery) { return this.run((r) => r.list(qs)) }
  lookup(qs: ListQuery & { userType?: string; employees?: string }) { return this.run((r) => r.lookup(qs)) }
  lookupOne(id: string) { return this.run(async (r) => { const u = await r.lookupOne(id); if (!u) throw notFound('User'); return u }) }
  get(id: string) { return this.run(async (r) => r.detail((await this.load(r, id)).Id)) }

  /** Internal user in PENDING_ACTIVATION with an unusable password; they get a set-password code by e-mail. */
  async create(input: UserCreate) {
    const unusable = await hashPassword(newRefreshToken()) // random secret nobody knows; replaced when the user sets a password
    const { out, code } = await this.run(async (r, q) => {
      const u = await r.insertInternal(input.email, input.displayName, input.phone, this.actor.id)
      await r.insertCredential(u.Id, unusable)
      if (input.roleIds?.length) await this.applyRoles(r, q, { Id: u.Id, PublicId: u.PublicId, Email: input.email, UserType: 'INTERNAL', Status: 'PENDING_ACTIVATION' }, input.roleIds)
      const code = await issueResetCode(q, this.cfg, input.email, INVITE_MIN, null)
      return { out: await r.detail(u.Id), code }
    })
    if (code) this.defer(resetMail(this.cfg, input.email, code, true))
    return out
  }

  update(id: string, input: UserUpdate) {
    return this.run(async (r) => { const u = await this.load(r, id); await r.update(u.Id, input, this.actor.id); return r.detail(u.Id) })
  }

  private async applyRoles(r: UserRepository, q: Queryable, u: UserCore, ids: number[]) {
    const uniq = [...new Set(ids)]
    const ok = await r.validRoles(uniq, u.UserType)
    if (ok.length !== uniq.length) throw new HttpError(422, 'INVALID_ROLE', `Every role must exist, not be deleted and have scope ${u.UserType}`)
    await r.replaceRoles(u.Id, uniq, this.actor.id)
    await this.log(q, u, 'ROLE_CHANGED', ok.map((x) => x.Code).sort().join(',') || '(none)')
  }
  setRoles(id: string, roleIds: number[]) {
    return this.run(async (r, q) => {
      const u = await this.load(r, id)
      this.notSelf(u, 'change the roles of') // no self-escalation
      await this.applyRoles(r, q, u, roleIds)
      return r.detail(u.Id)
    })
  }

  /** Disabling ends every session at once (requireAuth also re-checks Status on each request). */
  disable(id: string, reason?: string) {
    return this.run(async (r, q) => {
      const u = await this.load(r, id)
      this.notSelf(u, 'disable')
      if (u.Status === 'DISABLED') throw conflict('User is already disabled')
      await r.setStatus(u.Id, 'DISABLED', reason ?? null, this.actor.id)
      await new AuthRepository(q).endUserSessions(u.Id, 'USER_DISABLED', this.actor.id)
      await this.log(q, u, 'DEACTIVATED', reason)
      return r.detail(u.Id)
    })
  }
  enable(id: string) {
    return this.run(async (r, q) => {
      const u = await this.load(r, id)
      if (u.Status !== 'DISABLED') throw conflict(`Only a disabled user can be enabled (status is ${u.Status})`)
      await r.setStatus(u.Id, 'ACTIVE', null, this.actor.id)
      await this.log(q, u, 'ACTIVATED')
      return r.detail(u.Id)
    })
  }
  /** Clears the failed-login lockout; a user suspended after repeated lockouts (LOCKED) becomes ACTIVE again. */
  unlock(id: string) {
    return this.run(async (r, q) => {
      const u = await this.load(r, id)
      await r.resetLockout(u.Id)
      if (u.Status === 'LOCKED') await r.setStatus(u.Id, 'ACTIVE', null, this.actor.id)
      await this.log(q, u, 'ACTIVATED', 'unlock')
      return r.detail(u.Id)
    })
  }
  forceLogout(id: string) {
    return this.run(async (r, q) => {
      const u = await this.load(r, id)
      const ended = await new AuthRepository(q).endUserSessions(u.Id, 'REVOKED_BY_ADMIN', this.actor.id)
      if (ended.length) await this.log(q, u, 'SESSION_REVOKED', `${ended.length} session(s)`)
      return { ended: ended.length }
    })
  }
  sessions(id: string, qs: ListQuery & { active?: string }) { return this.run(async (r) => r.sessions((await this.load(r, id)).Id, qs)) }

  /** Admin-triggered password reset / re-invitation: e-mails the user a fresh code. */
  async sendReset(id: string) {
    const { email, code, invite } = await this.run(async (r, q) => {
      const u = await this.load(r, id)
      if (!(u.Status === 'ACTIVE' || (u.Status === 'PENDING_ACTIVATION' && u.UserType === 'INTERNAL'))) throw conflict(`Cannot reset the password of a ${u.Status} user`)
      const invite = u.Status === 'PENDING_ACTIVATION'
      const code = await issueResetCode(q, this.cfg, u.Email.toLowerCase(), invite ? INVITE_MIN : 15, null)
      if (!code) throw new HttpError(429, 'RATE_LIMITED', 'A code was sent recently, try again later')
      return { email: u.Email.toLowerCase(), code, invite }
    })
    this.defer(resetMail(this.cfg, email, code, invite))
    return { sent: true }
  }
}
