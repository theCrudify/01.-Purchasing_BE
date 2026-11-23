import type { Queryable } from '../../core/db'
import { runList, type ListQuery } from '../../core/list-query'
import { sessionList, userList, userLookupList, type UserListQuery } from './user.schema'

export type UserCore = { Id: number; PublicId: string; Email: string; UserType: string; Status: string }

/** SQL only. */
export class UserRepository {
  constructor(private q: Queryable) {}

  list(qs: UserListQuery) {
    const where: string[] = [], params: unknown[] = []
    if (qs.userType) { params.push(qs.userType); where.push(`t."UserType" = $${params.length}`) }
    if (qs.status) { params.push(qs.status); where.push(`t."Status" = $${params.length}`) }
    if (qs.roleId) { params.push(qs.roleId); where.push(`EXISTS (SELECT 1 FROM mst_user_role ur WHERE ur."UserId" = t."Id" AND ur."RoleId" = $${params.length})`) }
    return runList(this.q, userList, qs, { where, params })
  }
  lookup(qs: ListQuery & { userType?: string; employees?: string }) {
    const where = [`t."Status" = 'ACTIVE'`], params: unknown[] = []
    if (qs.userType) { params.push(qs.userType); where.push(`t."UserType" = $${params.length}`) }
    if (qs.employees) where.push(`t."EmployeeNo" IS NOT NULL`)
    return runList(this.q, userLookupList, qs, { where, params })
  }
  async lookupOne(publicId: string) {
    return (await this.q.query(`SELECT "PublicId" AS id, "Email" AS email, "DisplayName" AS "displayName", "UserType" AS "userType", "EmployeeNo" AS "employeeNo" FROM v_user_list WHERE "PublicId"=$1`, [publicId]))[0]
  }

  async core(publicId: string) {
    return (await this.q.query<UserCore>(`SELECT "Id","PublicId","Email","UserType","Status" FROM mst_user WHERE "PublicId"=$1`, [publicId]))[0]
  }
  async detail(id: number) {
    const cols = Object.entries(userList.select).map(([k, c]) => `"${c}" AS "${k}"`).join(',')
    const u = (await this.q.query<Record<string, unknown>>(`SELECT ${cols} FROM v_user_list WHERE "Id"=$1`, [id]))[0]
    const cred = (await this.q.query(
      `SELECT "AuthProvider" AS "authProvider", ("ExternalAuthId" IS NOT NULL) AS "ssoBound", "PasswordChangedAt" AS "passwordChangedAt",
              "FailedLoginCount" AS "failedLoginCount", "LockoutCount" AS "lockoutCount", "LockoutUntil" AS "lockoutUntil"
         FROM sys_user_credential WHERE "UserId"=$1`, [id]))[0] ?? null
    const roles = await this.q.query(
      `SELECT r."Id" AS id, r."Code" AS code, r."Name" AS name, r."Scope" AS scope FROM mst_user_role ur JOIN mst_role r ON r."Id"=ur."RoleId" WHERE ur."UserId"=$1 AND NOT r."IsDeleted" ORDER BY r."Code"`, [id])
    const activeSessions = (await this.q.query<{ n: number }>(`SELECT count(*)::int n FROM sys_user_session WHERE "UserId"=$1 AND "EndedAt" IS NULL AND "ExpiresAt" > now()`, [id]))[0]!.n
    return { ...u, credential: cred, roles, activeSessions }
  }

  async insertInternal(email: string, displayName: string, phone: string | null | undefined, actorId: number) {
    return (await this.q.query<{ Id: number; PublicId: string }>(
      `INSERT INTO mst_user ("UserType","Email","DisplayName","Phone","Status","CreatedBy","UpdatedBy") VALUES ('INTERNAL',$1,$2,$3,'PENDING_ACTIVATION',$4,$4) RETURNING "Id","PublicId"`,
      [email, displayName, phone ?? null, actorId]))[0]!
  }
  insertCredential(userId: number, unusableHash: string) {
    return this.q.query(`INSERT INTO sys_user_credential ("UserId","AuthProvider","PasswordHash") VALUES ($1,'LOCAL',$2)`, [userId, unusableHash])
  }
  update(id: number, data: { displayName?: string; phone?: string | null }, actorId: number) {
    return this.q.query(`UPDATE mst_user SET "DisplayName"=COALESCE($2,"DisplayName"),"Phone"=CASE WHEN $3::boolean THEN $4 ELSE "Phone" END,"UpdatedBy"=$5 WHERE "Id"=$1`,
      [id, data.displayName ?? null, data.phone !== undefined, data.phone ?? null, actorId])
  }
  setStatus(id: number, status: string, reason: string | null, actorId: number) {
    return this.q.query(`UPDATE mst_user SET "Status"=$2,"StatusReason"=$3,"UpdatedBy"=$4 WHERE "Id"=$1`, [id, status, reason, actorId])
  }
  resetLockout(id: number) {
    return this.q.query(`UPDATE sys_user_credential SET "FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL,"UpdatedAt"=now() WHERE "UserId"=$1`, [id])
  }

  /** Roles that exist, are not deleted and match the scope; returns their codes. */
  async validRoles(ids: number[], scope: string) {
    return this.q.query<{ Id: number; Code: string }>(`SELECT "Id","Code" FROM mst_role WHERE "Id"=ANY($1::int[]) AND NOT "IsDeleted" AND "Scope"=$2`, [ids, scope])
  }
  async replaceRoles(userId: number, ids: number[], actorId: number) {
    await this.q.query(`DELETE FROM mst_user_role WHERE "UserId"=$1 AND NOT ("RoleId"=ANY($2::int[]))`, [userId, ids])
    await this.q.query(`INSERT INTO mst_user_role ("UserId","RoleId","CreatedBy") SELECT $1, x, $3 FROM unnest($2::int[]) x ON CONFLICT DO NOTHING`, [userId, ids, actorId])
  }

  sessions(userId: number, qs: ListQuery & { active?: string }) {
    const where = ['t."UserId" = $1'], params: unknown[] = [userId]
    if (qs.active) where.push(qs.active === 'true' ? 't."IsActive"' : 'NOT t."IsActive"')
    return runList(this.q, sessionList, qs, { where, params })
  }
}
