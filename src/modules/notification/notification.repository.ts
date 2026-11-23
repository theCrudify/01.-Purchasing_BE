import type { Queryable } from '../../core/db'
import { runList } from '../../core/list-query'
import { notificationList, type NotificationListQuery } from './notification.schema'

export type Notify = { userId: number; documentId?: number | null; eventType: string; title: string; body?: string; email?: boolean }

/** SQL only. */
export class NotificationRepository {
  constructor(private q: Queryable) {}
  async add(n: Notify) {
    await this.q.query(`INSERT INTO tr_notification ("RecipientUserId","DocumentId","EventType","Title","Body","EmailStatus") VALUES ($1,$2,$3,left($4,200),left($5,1000),$6)`,
      [n.userId, n.documentId ?? null, n.eventType, n.title, n.body ?? null, n.email === false ? 'NONE' : 'QUEUED'])
  }
  list(userId: number, qs: NotificationListQuery) {
    const where = [`t."RecipientUserId" = $1`]
    if (qs.unread) where.push(`t."ReadAt" IS NULL`)
    return runList(this.q, notificationList, qs, { where, params: [userId] })
  }
  async unread(userId: number) { return (await this.q.query<{ n: number }>(`SELECT count(*)::int n FROM tr_notification WHERE "RecipientUserId"=$1 AND "ReadAt" IS NULL`, [userId]))[0]!.n }
  async markRead(userId: number, publicId?: string) {
    await this.q.query(`UPDATE tr_notification SET "ReadAt"=now() WHERE "RecipientUserId"=$1 AND "ReadAt" IS NULL AND ($2::uuid IS NULL OR "PublicId"=$2::uuid)`, [userId, publicId ?? null])
  }
  /** Claim a batch of queued e-mails (SKIP LOCKED: parallel dispatchers never double-send). */
  claimQueued(limit: number) {
    return this.q.query<{ id: number; email: string; name: string; title: string; body: string | null; docType: string | null; docPublicId: string | null }>(
      `UPDATE tr_notification n SET "EmailStatus"='SENDING' FROM (
         SELECT x."Id" FROM tr_notification x WHERE x."EmailStatus"='QUEUED' ORDER BY x."Id" LIMIT $1 FOR UPDATE SKIP LOCKED) s
       WHERE n."Id"=s."Id"
       RETURNING n."Id" AS id, (SELECT "Email" FROM mst_user WHERE "Id"=n."RecipientUserId") AS email,
                 (SELECT "DisplayName" FROM mst_user WHERE "Id"=n."RecipientUserId") AS name, n."Title" AS title, n."Body" AS body,
                 (SELECT "DocType" FROM tr_document WHERE "Id"=n."DocumentId") AS "docType", (SELECT "PublicId"::text FROM tr_document WHERE "Id"=n."DocumentId") AS "docPublicId"`, [limit])
  }
  markSent(id: number, error: string | null) {
    return this.q.query(`UPDATE tr_notification SET "EmailStatus"=$2,"EmailSentAt"=CASE WHEN $3::text IS NULL THEN now() END,"EmailError"=left($3,1000) WHERE "Id"=$1`,
      [id, error ? 'FAILED' : 'SENT', error])
  }
}
