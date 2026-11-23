import type { Queryable } from '../../core/db'

/** SQL only: housekeeping. */
export class CronRepository {
  constructor(private q: Queryable) {}
  async expireSessions() {
    return (await this.q.query(`UPDATE sys_user_session SET "EndedAt"=now(),"EndReason"='EXPIRED' WHERE "EndedAt" IS NULL AND "ExpiresAt" < now() RETURNING 1`)).length
  }
  async requeueStuckMails() {
    return (await this.q.query(`UPDATE tr_notification SET "EmailStatus"='QUEUED' WHERE "EmailStatus"='SENDING' AND "CreatedAt" < now() - interval '15 minutes' RETURNING 1`)).length
  }
  async purgeOldCodes() {
    return (await this.q.query(`DELETE FROM sys_one_time_code WHERE "ExpiresAt" < now() - interval '30 days' RETURNING 1`)).length
  }
}
