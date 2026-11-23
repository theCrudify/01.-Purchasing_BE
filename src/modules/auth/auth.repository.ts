import type { Queryable } from '../../core/db'
import type { Actor } from '../../core/types'

export type CredentialRow = {
  UserId: number; Status: string; PasswordHash: string | null; AuthProvider: string
  FailedLoginCount: number; LockoutCount: number; LockoutUntil: Date | null
}

/** SQL only. No business rules, no HTTP. */
export class AuthRepository {
  constructor(private q: Queryable) {}

  async findCredentialByEmail(email: string) {
    return (await this.q.query<CredentialRow>(
      `SELECT u."Id" AS "UserId", u."Status", c."PasswordHash", c."AuthProvider", c."FailedLoginCount", c."LockoutCount", c."LockoutUntil"
         FROM mst_user u JOIN sys_user_credential c ON c."UserId" = u."Id" WHERE lower(u."Email") = $1`, [email]))[0]
  }

  async publicId(userId: number) { return (await this.q.query<{ PublicId: string }>(`SELECT "PublicId" FROM mst_user WHERE "Id"=$1`, [userId]))[0]!.PublicId }

  recordFailure(userId: number, failed: number, lockoutCount: number, lockoutUntil: Date | null) {
    return this.q.query(`UPDATE sys_user_credential SET "FailedLoginCount"=$2,"LockoutCount"=$3,"LockoutUntil"=$4,"UpdatedAt"=now() WHERE "UserId"=$1`, [userId, failed, lockoutCount, lockoutUntil])
  }
  lockUser(userId: number) { return this.q.query(`UPDATE mst_user SET "Status"='LOCKED',"StatusReason"='Too many failed logins',"UpdatedAt"=now() WHERE "Id"=$1`, [userId]) }
  resetFailures(userId: number) { return this.q.query(`UPDATE sys_user_credential SET "FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL,"UpdatedAt"=now() WHERE "UserId"=$1`, [userId]) }

  async createSession(userId: number, ip: string | null, ua: string | null, expiresAt: Date, method = 'PASSWORD') {
    return (await this.q.query<{ Id: number }>(
      `INSERT INTO sys_user_session ("UserId","AuthMethod","IpAddress","UserAgent","ExpiresAt") VALUES ($1,$5,$2,left($3,500),$4) RETURNING "Id"`,
      [userId, ip, ua, expiresAt, method]))[0]!.Id
  }
  addRefreshToken(sessionId: number, hashHex: string, expiresAt: Date) {
    return this.q.query(`INSERT INTO sys_refresh_token ("SessionId","TokenHash","ExpiresAt") VALUES ($1, decode($2,'hex'), $3)`, [sessionId, hashHex, expiresAt])
  }
  async findRefreshToken(hashHex: string) {
    return (await this.q.query<{ Id: number; SessionId: number; RotatedAt: Date | null; RevokedAt: Date | null; ExpiresAt: Date; EndedAt: Date | null; SessionExpiresAt: Date; PublicId: string }>(
      `SELECT r."Id", r."SessionId", r."RotatedAt", r."RevokedAt", r."ExpiresAt", s."EndedAt", s."ExpiresAt" AS "SessionExpiresAt", u."PublicId"
         FROM sys_refresh_token r JOIN sys_user_session s ON s."Id"=r."SessionId" JOIN mst_user u ON u."Id"=s."UserId"
        WHERE r."TokenHash" = decode($1,'hex') FOR UPDATE OF r`, [hashHex]))[0]
  }
  rotateRefreshToken(id: number) { return this.q.query(`UPDATE sys_refresh_token SET "RotatedAt"=now() WHERE "Id"=$1`, [id]) }
  touchSession(id: number) { return this.q.query(`UPDATE sys_user_session SET "LastSeenAt"=now() WHERE "Id"=$1`, [id]) }
  async endSession(id: number, reason: string) {
    await this.q.query(`UPDATE sys_user_session SET "EndedAt"=now(),"EndReason"=$2 WHERE "Id"=$1 AND "EndedAt" IS NULL`, [id, reason])
    await this.q.query(`UPDATE sys_refresh_token SET "RevokedAt"=now() WHERE "SessionId"=$1 AND "RevokedAt" IS NULL`, [id])
  }

  /** End every live session of a user (optionally keeping one) and revoke their refresh tokens. Returns ended session ids. */
  async endUserSessions(userId: number, reason: string, endedBy: number | null = null, exceptSessionId: number | null = null) {
    const ids = (await this.q.query<{ Id: number }>(
      `UPDATE sys_user_session SET "EndedAt"=now(),"EndReason"=$2,"EndedBy"=$3
        WHERE "UserId"=$1 AND "EndedAt" IS NULL AND ($4::bigint IS NULL OR "Id"<>$4) RETURNING "Id"`, [userId, reason, endedBy, exceptSessionId])).map((r) => r.Id)
    if (ids.length) await this.q.query(`UPDATE sys_refresh_token SET "RevokedAt"=now() WHERE "SessionId"=ANY($1::bigint[]) AND "RevokedAt" IS NULL`, [ids])
    return ids
  }

  /** hist_user_activity: security events (append-only). */
  logActivity(a: { userId?: number | null; sessionId?: number | null; email?: string | null; action: string; ip?: string | null; ua?: string | null; detail?: string | null }) {
    return this.q.query(`INSERT INTO hist_user_activity ("UserId","SessionId","Email","Action","IpAddress","UserAgent","Detail") VALUES ($1,$2,$3,$4,left($5,45),left($6,500),left($7,500))`,
      [a.userId ?? null, a.sessionId ?? null, a.email ?? null, a.action, a.ip ?? null, a.ua ?? null, a.detail ?? null])
  }

  /** SSO: user bound to this Entra object id, or an ACTIVE INTERNAL user with this e-mail not yet bound to anyone. */
  async findSsoUser(oid: string, email: string) {
    return (await this.q.query<{ UserId: number; Status: string; UserType: string; ExternalAuthId: string | null }>(
      `SELECT u."Id" AS "UserId", u."Status", u."UserType", c."ExternalAuthId" FROM mst_user u JOIN sys_user_credential c ON c."UserId"=u."Id"
        WHERE c."ExternalAuthId" = $1 OR (lower(u."Email") = $2 AND c."ExternalAuthId" IS NULL)
        ORDER BY (c."ExternalAuthId" = $1) DESC NULLS LAST LIMIT 1`, [oid, email]))[0]
  }
  bindExternalId(userId: number, oid: string) {
    return this.q.query(`UPDATE sys_user_credential SET "ExternalAuthId"=$2,"UpdatedAt"=now() WHERE "UserId"=$1 AND "ExternalAuthId" IS NULL`, [userId, oid])
  }

  /** Live session + ACTIVE user + effective permissions in two small queries. */
  async loadActor(sessionId: number): Promise<Actor | null> {
    const u = (await this.q.query<{ Id: number; PublicId: string; UserType: Actor['userType']; Email: string; DisplayName: string }>(
      `SELECT u."Id",u."PublicId",u."UserType",u."Email",u."DisplayName" FROM sys_user_session s JOIN mst_user u ON u."Id"=s."UserId"
        WHERE s."Id"=$1 AND s."EndedAt" IS NULL AND s."ExpiresAt" > now() AND u."Status"='ACTIVE'`, [sessionId]))[0]
    if (!u) return null
    const perms = await this.q.query<{ Code: string }>(
      `SELECT DISTINCT p."Code" FROM mst_user_role ur JOIN mst_role r ON r."Id"=ur."RoleId" AND r."IsActive" AND NOT r."IsDeleted"
         JOIN mst_role_permission rp ON rp."RoleId"=r."Id" JOIN mst_permission p ON p."Id"=rp."PermissionId" WHERE ur."UserId"=$1`, [u.Id])
    return { id: Number(u.Id), publicId: u.PublicId, userType: u.UserType, email: u.Email, displayName: u.DisplayName, sessionId: sessionId, permissions: new Set(perms.map((p) => p.Code)) }
  }
}
