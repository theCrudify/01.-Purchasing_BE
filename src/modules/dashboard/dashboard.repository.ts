import type { Queryable } from '../../core/db'

/** SQL only. Small aggregates for the landing pages. */
export class DashboardRepository {
  constructor(private q: Queryable) {}
  myDocuments(userId: number) {
    return this.q.query<{ docType: string; status: string; n: number }>(
      `SELECT "DocType" AS "docType", "Status" AS status, count(*)::int AS n FROM tr_document
        WHERE "OwnerUserId"=$1 AND NOT "IsDeleted" GROUP BY 1,2 ORDER BY 1,2`, [userId])
  }
  /** Last 6 months (DocDate) incl. empty ones, bucketed like the dashboard: draft / pending / approved. */
  myMonthly(userId: number) {
    return this.q.query<{ month: string; draft: number; pending: number; approved: number }>(
      `SELECT to_char(m, 'YYYY-MM') AS month,
              count(d."Id") FILTER (WHERE d."Status" IN ('DRAFT','RETURNED','REVISION_REQUIRED'))::int AS draft,
              count(d."Id") FILTER (WHERE d."Status" IN ('PENDING_APPROVAL','SUBMITTED'))::int AS pending,
              count(d."Id") FILTER (WHERE d."Status" IN ('APPROVED','ISSUED','POSTED','PAID'))::int AS approved
         FROM generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') m
         LEFT JOIN tr_document d ON d."OwnerUserId"=$1 AND NOT d."IsDeleted" AND date_trunc('month', d."DocDate") = m
        GROUP BY m ORDER BY m`, [userId])
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
