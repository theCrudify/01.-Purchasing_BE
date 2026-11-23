import type { Queryable } from '../../core/db'

/** SQL only. Small aggregates for the landing pages. */
export class DashboardRepository {
  constructor(private q: Queryable) {}
  myDocuments(userId: number) {
    return this.q.query<{ docType: string; status: string; n: number }>(
      `SELECT "DocType" AS "docType", "Status" AS status, count(*)::int AS n FROM tr_document
        WHERE "OwnerUserId"=$1 AND NOT "IsDeleted" GROUP BY 1,2 ORDER BY 1,2`, [userId])
  }
  recentNotifications(userId: number) {
    return this.q.query(`SELECT "PublicId" AS id, "Title" AS title, "EventType" AS "eventType", "ReadAt" AS "readAt", "CreatedAt" AS "createdAt"
      FROM tr_notification WHERE "RecipientUserId"=$1 ORDER BY "CreatedAt" DESC LIMIT 5`, [userId])
  }
  /** Portal: documents of the BPs the user belongs to (portal-visible types only). */
  bpDocuments(userId: number, docTypes: string[]) {
    return this.q.query<{ docType: string; status: string; n: number }>(
      `SELECT d."DocType" AS "docType", d."Status" AS status, count(*)::int AS n FROM tr_document d
        WHERE d."BpId" IN (SELECT "BpId" FROM mst_bp_user WHERE "UserId"=$1 AND "IsActive") AND NOT d."IsDeleted" AND d."DocType" = ANY($2)
        GROUP BY 1,2 ORDER BY 1,2`, [userId, docTypes])
  }
}
