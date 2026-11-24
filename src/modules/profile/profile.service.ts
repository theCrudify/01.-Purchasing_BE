import bcrypt from 'bcryptjs'
import { hashPassword } from '../password-reset/password-reset.service'
import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { HttpError, notFound } from '../../core/errors'
import { readFile, saveFile } from '../../core/storage'
import { ProfileRepository } from './profile.repository'
import type { PasswordChange, ProfileUpdate } from './profile.schema'

/** Self-service for the signed-in user (internal or BP). */
export class ProfileService {
  constructor(private db: Db, private actor: Actor) {}
  private run<T>(fn: (r: ProfileRepository, q: Parameters<Parameters<Db['session']>[1]>[0]) => Promise<T>) {
    return this.db.session(this.actor, (q) => fn(new ProfileRepository(q), q))
  }

  get() { return this.run((r) => r.get(this.actor.id)) }
  update(d: ProfileUpdate) { return this.run(async (r) => { await r.update(this.actor.id, d); return r.get(this.actor.id) }) }

  /** Verify current password, store the new hash, end every other session. */
  async changePassword(d: PasswordChange, ip: string | null) {
    const hash = await this.run((r) => r.passwordHash(this.actor.id))
    if (!hash) throw new HttpError(422, 'SSO_ACCOUNT', 'This account signs in with Microsoft; change the password there')
    if (!(await bcrypt.compare(d.currentPassword, hash))) throw new HttpError(422, 'WRONG_PASSWORD', 'Current password is incorrect')
    if (d.currentPassword === d.newPassword) throw new HttpError(422, 'SAME_PASSWORD', 'New password must differ from the current one')
    const next = await hashPassword(d.newPassword)
    await this.run(async (r) => {
      await r.setPassword(this.actor.id, next)
      await r.endOtherSessions(this.actor.id, this.actor.sessionId)
      await r.logActivity(this.actor.id, this.actor.sessionId, 'PASSWORD_CHANGED', ip)
    })
  }

  uploadSignature(file: File) {
    if (!/\.(png|jpe?g)$/i.test(file?.name ?? '')) throw new HttpError(422, 'FILE_TYPE', 'Signature must be PNG or JPG')
    return this.run(async (r, q) => { const f = await saveFile(q, this.actor.id, file); await r.setSignature(this.actor.id, f.id); return { hasSignature: true } })
  }

  signature() {
    return this.run(async (r, q) => {
      const id = await r.signatureFileId(this.actor.id)
      const f = id && (await readFile(q, id))
      if (!f) throw notFound('Signature')
      return f
    })
  }
}
