import type { Queryable } from '../../core/db'

/** SQL only — always scoped to the signed-in user's own row. */
export class ProfileRepository {
  constructor(private q: Queryable) {}
  async get(userId: number) {
    return (await this.q.query(
      `SELECT u."PublicId" AS id, u."Email" AS email, u."DisplayName" AS "displayName", u."Phone" AS phone, u."UserType" AS "userType",
              u."SignatureFileId" IS NOT NULL AS "hasSignature", e."EmployeeNo" AS "employeeNo", d."Name" AS "departmentName", s."DisplayName" AS "superiorName",
              c."AuthProvider" AS "authProvider", c."PasswordChangedAt" AS "passwordChangedAt"
         FROM mst_user u LEFT JOIN sys_user_credential c ON c."UserId"=u."Id" LEFT JOIN mst_employee e ON e."UserId"=u."Id"
         LEFT JOIN mst_department d ON d."Id"=e."DepartmentId" LEFT JOIN mst_user s ON s."Id"=e."SuperiorUserId" WHERE u."Id"=$1`, [userId]))[0]
  }
  update(userId: number, d: { displayName?: string; phone?: string | null }) {
    return this.q.query(`UPDATE mst_user SET "DisplayName"=COALESCE($2,"DisplayName"),"Phone"=CASE WHEN $4 THEN $3 ELSE "Phone" END,"UpdatedBy"=$1 WHERE "Id"=$1`,
      [userId, d.displayName ?? null, d.phone ?? null, 'phone' in d])
  }
  async passwordHash(userId: number) {
    return (await this.q.query<{ h: string | null }>(`SELECT "PasswordHash" AS h FROM sys_user_credential WHERE "UserId"=$1 AND "AuthProvider"='LOCAL'`, [userId]))[0]?.h ?? null
  }
  setPassword(userId: number, hash: string) {
    return this.q.query(`UPDATE sys_user_credential SET "PasswordHash"=$2,"PasswordChangedAt"=now(),"FailedLoginCount"=0 WHERE "UserId"=$1`, [userId, hash])
  }
  async endOtherSessions(userId: number, keepSessionId: number) {
    await this.q.query(`UPDATE sys_refresh_token SET "RevokedAt"=now() WHERE "RevokedAt" IS NULL AND "SessionId" IN (SELECT "Id" FROM sys_user_session WHERE "UserId"=$1 AND "Id"<>$2 AND "EndedAt" IS NULL)`, [userId, keepSessionId])
    await this.q.query(`UPDATE sys_user_session SET "EndedAt"=now(),"EndReason"='PASSWORD_CHANGED' WHERE "UserId"=$1 AND "Id"<>$2 AND "EndedAt" IS NULL`, [userId, keepSessionId])
  }
  logActivity(userId: number, sessionId: number, action: string, ip: string | null) {
    return this.q.query(`INSERT INTO hist_user_activity ("UserId","SessionId","Action","IpAddress") VALUES ($1,$2,$3,$4)`, [userId, sessionId, action, ip])
  }
  setSignature(userId: number, fileId: number) { return this.q.query(`UPDATE mst_user SET "SignatureFileId"=$2 WHERE "Id"=$1`, [userId, fileId]) }
  async signatureFileId(userId: number) {
    return (await this.q.query<{ f: number | null }>(`SELECT "SignatureFileId" AS f FROM mst_user WHERE "Id"=$1`, [userId]))[0]?.f ?? null
  }
}
