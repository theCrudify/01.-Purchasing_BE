import bcrypt from 'bcryptjs'
import type { Db } from '../../core/db'
import { HttpError, unauthorized } from '../../core/errors'
import { AuthRepository } from './auth.repository'
import { newRefreshToken, sha256Hex, signAccessToken, REFRESH_TTL_S, SESSION_MAX_S } from './auth.tokens'
import type { LoginInput } from './auth.schema'

const SYSTEM = { id: null, userType: 'SYSTEM' } as const
const MAX_FAILS = 5
const MAX_LOCK_CYCLES = 5
// Real hash (made once per isolate) so unknown e-mails cost the same as wrong passwords: no user enumeration by timing.
let dummy: string | undefined
const DUMMY_HASH = () => (dummy ??= bcrypt.hashSync('dummy-password', 12))

const GENERIC = () => unauthorized('Invalid email or password')
const addSec = (s: number) => new Date(Date.now() + s * 1000)

export class AuthService {
  constructor(private db: Db, private jwtSecret: string) {}

  async login(input: LoginInput, ip: string | null, ua: string | null) {
    return this.db.session(SYSTEM, async (q) => {
      const repo = new AuthRepository(q)
      const cred = await repo.findCredentialByEmail(input.email)
      const fail = async (detail: string, userId: number | null = null) => {
        await repo.logActivity({ userId, email: input.email, action: 'LOGIN_FAILED', ip, ua, detail })
        return { fail: true as const } // committed on purpose: throwing would roll the log / counters back
      }
      if (!cred || !cred.PasswordHash || cred.AuthProvider !== 'LOCAL') { await bcrypt.compare(input.password, DUMMY_HASH()); return fail('UNKNOWN_USER') }
      if (cred.Status !== 'ACTIVE') { await bcrypt.compare(input.password, DUMMY_HASH()); return fail(`USER_${cred.Status}`, cred.UserId) }
      if (cred.LockoutUntil && cred.LockoutUntil > new Date()) throw new HttpError(429, 'LOCKED_OUT', 'Account temporarily locked, try again later')

      if (!(await bcrypt.compare(input.password, cred.PasswordHash))) {
        let fails = cred.FailedLoginCount + 1, cycles = cred.LockoutCount, until: Date | null = null
        if (fails >= MAX_FAILS) { cycles++; fails = 0; until = addSec((15 + 5 * (cycles - 1)) * 60) } // 15 + 5×(n−1) minutes
        await repo.recordFailure(cred.UserId, fails, cycles, until)
        if (cycles >= MAX_LOCK_CYCLES) await repo.lockUser(cred.UserId)
        if (until) await repo.logActivity({ userId: cred.UserId, email: input.email, action: 'LOCKED_OUT', ip, ua })
        return fail('WRONG_PASSWORD', cred.UserId)
      }
      await repo.resetFailures(cred.UserId)
      return { fail: false as const, ...(await this.openSession(repo, cred.UserId, ip, ua)) }
    }).then((r) => { if (r.fail) throw GENERIC(); return r })
  }

  /** New session + refresh token + access token; shared by password login and SSO. */
  async openSession(repo: AuthRepository, userId: number, ip: string | null, ua: string | null, method = 'PASSWORD') {
    const sid = await repo.createSession(userId, ip, ua, addSec(SESSION_MAX_S), method)
    const refresh = newRefreshToken()
    await repo.addRefreshToken(sid, await sha256Hex(refresh), addSec(REFRESH_TTL_S))
    await repo.logActivity({ userId, sessionId: sid, action: 'LOGIN', ip, ua, detail: method })
    const pub = await repo.publicId(userId)
    return { access: await signAccessToken(this.jwtSecret, { sub: pub, sid }), refresh }
  }

  /** SSO login: an Entra identity may sign in only as an existing ACTIVE INTERNAL user (bound on first use, never auto-created). */
  async ssoLogin(oid: string, email: string, ip: string | null, ua: string | null) {
    const out = await this.db.session(SYSTEM, async (q) => {
      const repo = new AuthRepository(q)
      const u = await repo.findSsoUser(oid, email)
      if (!u || u.Status !== 'ACTIVE' || u.UserType !== 'INTERNAL' || (u.ExternalAuthId && u.ExternalAuthId !== oid)) {
        await repo.logActivity({ userId: u?.UserId ?? null, email, action: 'LOGIN_FAILED', ip, ua, detail: 'SSO_NO_MATCH' })
        return null
      }
      if (!u.ExternalAuthId) await repo.bindExternalId(u.UserId, oid)
      return this.openSession(repo, u.UserId, ip, ua, 'ENTRA_ID')
    })
    if (!out) throw unauthorized('No active Purchasing Portal account for this Microsoft identity')
    return out
  }

  /** Rotating refresh token; replaying an old one kills the whole session (token theft signal). */
  async refresh(rawRefresh: string) {
    const hash = await sha256Hex(rawRefresh)
    const out = await this.db.session(SYSTEM, async (q) => {
      const repo = new AuthRepository(q)
      const t = await repo.findRefreshToken(hash)
      if (!t || t.EndedAt || t.SessionExpiresAt < new Date() || t.ExpiresAt < new Date() || t.RevokedAt) return null
      if (t.RotatedAt) { await repo.endSession(t.SessionId, 'TOKEN_REUSE'); await repo.logActivity({ sessionId: t.SessionId, action: 'TOKEN_REUSE_DETECTED' }); return null }
      await repo.rotateRefreshToken(t.Id)
      const next = newRefreshToken()
      await repo.addRefreshToken(t.SessionId, await sha256Hex(next), addSec(REFRESH_TTL_S))
      await repo.touchSession(t.SessionId)
      return { access: await signAccessToken(this.jwtSecret, { sub: t.PublicId, sid: t.SessionId }), refresh: next }
    })
    if (!out) throw unauthorized('Session expired')
    return out
  }

  logout(actor: { id: number; sessionId: number }) {
    return this.db.session(SYSTEM, async (q) => {
      const repo = new AuthRepository(q)
      await repo.endSession(actor.sessionId, 'LOGOUT')
      await repo.logActivity({ userId: actor.id, sessionId: actor.sessionId, action: 'LOGOUT' })
    })
  }
}
