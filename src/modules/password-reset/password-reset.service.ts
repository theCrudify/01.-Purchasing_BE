import { hashPassword } from '../../core/password'
import type { Db, Queryable } from '../../core/db'
import type { Config } from '../../env'
import { HttpError } from '../../core/errors'
import { mailLayout, sendMail } from '../../core/mailer'
import { AuthRepository } from '../auth/auth.repository'
import { PasswordResetRepository } from './password-reset.repository'
import type { ResetComplete } from './password-reset.schema'

const SYSTEM = { id: null, userType: 'SYSTEM' } as const
const PURPOSE = 'PASSWORD_RESET'
const MAX_ATTEMPTS = 5
const RESET_MIN = 15
export const INVITE_MIN = 30 // DB caps a code's life at 30 minutes
export type Defer = (p: Promise<unknown>) => void

const badCode = () => new HttpError(422, 'INVALID_CODE', 'Invalid or expired code')
async function hmacHex(secret: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))), (x) => x.toString(16).padStart(2, '0')).join('')
}
const codeHash = (cfg: Config, email: string, code: string) => hmacHex(cfg.JWT_SECRET, `${PURPOSE}:${email}:${code}`) // peppered: a DB leak alone can't brute-force codes
const sixDigits = () => String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0')
/** Users who may (re)set a password: active ones, and internal users still waiting to set their first password. */
const eligible = (u: { Status: string; UserType: string }) => u.Status === 'ACTIVE' || (u.Status === 'PENDING_ACTIVATION' && u.UserType === 'INTERNAL')

/**
 * Issue a fresh reset / invitation code inside the caller's transaction. Older open codes are invalidated.
 * Throttled to 1 per minute and 5 per day per e-mail; returns null when throttled (callers must not reveal that).
 */
export async function issueResetCode(q: Queryable, cfg: Config, email: string, minutes: number, ip: string | null) {
  const repo = new PasswordResetRepository(q)
  const n = await repo.recentCounts(email, PURPOSE)
  if (n.minute >= 1 || n.day >= 5) return null
  const code = sixDigits()
  await repo.invalidateOpen(email, PURPOSE)
  await repo.insert(email, PURPOSE, await codeHash(cfg, email, code), minutes, ip)
  return code
}

export function resetMail(cfg: Config, to: string, code: string, invite: boolean) {
  const base = (cfg.APP_URL ?? cfg.ALLOWED_ORIGINS.split(',')[0]!).trim().replace(/\/$/, '')
  const href = `${base}/forgot-password?${new URLSearchParams({ email: to, code })}`
  const min = invite ? INVITE_MIN : RESET_MIN
  return sendMail(cfg, invite
    ? { to, subject: 'Your Purchasing Portal account', html: mailLayout('Welcome to Purchasing Portal', [`An account was created for ${to}.`, `Set your password with code ${code} (valid ${min} minutes). If it expires, use "Forgot password" on the sign-in page.`], { href, label: 'Set your password' }) }
    : { to, subject: 'Purchasing Portal password reset code', html: mailLayout('Password reset', [`Your code is ${code}. It is valid for ${min} minutes.`, 'If you did not ask for this, ignore this e-mail.'], { href, label: 'Reset your password' }) })
}

/** Public 2-step forgot-password. Every answer is identical whether or not the e-mail exists (no user enumeration). */
export class PasswordResetService {
  constructor(private db: Db, private cfg: Config, private defer: Defer) {}

  async request(email: string, ip: string | null) {
    const code = await this.db.session(SYSTEM, async (q) => {
      const u = await new PasswordResetRepository(q).findUser(email)
      return u && eligible(u) ? issueResetCode(q, this.cfg, email, RESET_MIN, ip) : null
    })
    if (code) this.defer(resetMail(this.cfg, email, code, false)) // not awaited: response time must not depend on the e-mail existing
    return { ok: true }
  }

  /** Checks the code; a wrong guess is committed to the attempt counter before the error is thrown. */
  private async check(email: string, code: string, then: (q: Queryable, row: { Id: number; VerifiedAt: Date | null }) => Promise<unknown>) {
    const ok = await this.db.session(SYSTEM, async (q) => {
      const repo = new PasswordResetRepository(q)
      const row = await repo.latestOpen(email, PURPOSE)
      if (!row || row.Attempts >= MAX_ATTEMPTS) return false
      if (row.CodeHash !== (await codeHash(this.cfg, email, code))) { await repo.bumpAttempts(row.Id); return false }
      await then(q, row)
      return true
    })
    if (!ok) throw badCode()
  }

  verify(email: string, code: string) {
    return this.check(email, code, (q, row) => new PasswordResetRepository(q).markVerified(row.Id)).then(() => ({ ok: true }))
  }

  async reset(input: ResetComplete, ip: string | null) {
    const hash = await hashPassword(input.newPassword)
    await this.check(input.email, input.code, async (q, row) => {
      const repo = new PasswordResetRepository(q), auth = new AuthRepository(q)
      const u = await repo.findUser(input.email)
      if (!row.VerifiedAt || !u || !eligible(u)) throw badCode() // step 1 (verify) is mandatory
      await repo.setPassword(u.Id, hash)
      await repo.activateInvited(u.Id)
      await repo.consume(row.Id)
      await auth.endUserSessions(u.Id, 'PASSWORD_CHANGED')
      await auth.logActivity({ userId: u.Id, email: u.Email, action: 'PASSWORD_RESET', ip })
    })
    return { ok: true }
  }
}
