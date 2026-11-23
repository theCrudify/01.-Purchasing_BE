import type { Queryable } from '../../core/db'

export type CodeRow = { Id: number; CodeHash: string; Attempts: number; ExpiresAt: Date; VerifiedAt: Date | null }

/** SQL only (sys_one_time_code + the credential columns a reset touches). */
export class PasswordResetRepository {
  constructor(private q: Queryable) {}

  async findUser(email: string) {
    return (await this.q.query<{ Id: number; Status: string; UserType: string; Email: string; DisplayName: string }>(
      `SELECT "Id","Status","UserType","Email","DisplayName" FROM mst_user WHERE lower("Email")=$1`, [email]))[0]
  }
  async recentCounts(email: string, purpose: string) {
    return (await this.q.query<{ minute: number; day: number }>(
      `SELECT count(*) FILTER (WHERE "CreatedAt" > now() - interval '1 minute')::int AS minute, count(*)::int AS day
         FROM sys_one_time_code WHERE "Email"=$1 AND "Purpose"=$2 AND "CreatedAt" > now() - interval '24 hours'`, [email, purpose]))[0]!
  }
  invalidateOpen(email: string, purpose: string) {
    return this.q.query(`UPDATE sys_one_time_code SET "InvalidatedAt"=now() WHERE "Email"=$1 AND "Purpose"=$2 AND "ConsumedAt" IS NULL AND "InvalidatedAt" IS NULL`, [email, purpose])
  }
  insert(email: string, purpose: string, hashHex: string, minutes: number, ip: string | null) {
    return this.q.query(`INSERT INTO sys_one_time_code ("Email","Purpose","CodeHash","ExpiresAt","RequestIp") VALUES ($1,$2,decode($3,'hex'),now() + make_interval(mins => $4),$5)`,
      [email, purpose, hashHex, minutes, ip])
  }
  /** The one live code for this e-mail (newer codes invalidate older ones), locked for the attempt counter. */
  async latestOpen(email: string, purpose: string) {
    return (await this.q.query<CodeRow>(
      `SELECT "Id", encode("CodeHash",'hex') AS "CodeHash", "Attempts", "ExpiresAt", "VerifiedAt" FROM sys_one_time_code
        WHERE "Email"=$1 AND "Purpose"=$2 AND "ConsumedAt" IS NULL AND "InvalidatedAt" IS NULL AND "ExpiresAt" > now()
        ORDER BY "CreatedAt" DESC LIMIT 1 FOR UPDATE`, [email, purpose]))[0]
  }
  bumpAttempts(id: number) { return this.q.query(`UPDATE sys_one_time_code SET "Attempts"="Attempts"+1 WHERE "Id"=$1`, [id]) }
  markVerified(id: number) { return this.q.query(`UPDATE sys_one_time_code SET "VerifiedAt"=COALESCE("VerifiedAt", now()) WHERE "Id"=$1`, [id]) }
  consume(id: number) { return this.q.query(`UPDATE sys_one_time_code SET "ConsumedAt"=now() WHERE "Id"=$1`, [id]) }

  setPassword(userId: number, hash: string) {
    return this.q.query(`UPDATE sys_user_credential SET "PasswordHash"=$2,"PasswordChangedAt"=now(),"FailedLoginCount"=0,"LockoutUntil"=NULL,"UpdatedAt"=now() WHERE "UserId"=$1`, [userId, hash])
  }
  /** A new internal user becomes ACTIVE once they set their own password. */
  activateInvited(userId: number) {
    return this.q.query(`UPDATE mst_user SET "Status"='ACTIVE',"EmailVerifiedAt"=COALESCE("EmailVerifiedAt",now()) WHERE "Id"=$1 AND "Status"='PENDING_ACTIVATION' AND "UserType"='INTERNAL'`, [userId])
  }
}
