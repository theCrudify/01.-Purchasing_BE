import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { ipAllowListDef } from './security.schema'

/** SQL only. */
export class IpAllowListRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, ipAllowListDef) }

  override create(data: Record<string, unknown>, actorId: number | null) { return super.create({ ...data, createdBy: actorId }, null) }

  async remove(id: number) {
    return (await this.q.query(`DELETE FROM sys_ip_allow_list WHERE "Id"=$1 RETURNING "Id" AS id, "IpOrCidr" AS "ipOrCidr"`, [id]))[0]
  }

  /** Allowed when the list has no active row (enforcement off) or an active row covers the ip. */
  async allows(ip: string | null) {
    const r = await this.q.query<{ ok: boolean; enforced: boolean }>(
      `WITH a AS (SELECT "IpOrCidr" FROM sys_ip_allow_list WHERE "IsActive")
       SELECT EXISTS (SELECT 1 FROM a) AS enforced,
              (NOT EXISTS (SELECT 1 FROM a) OR ($1::text IS NOT NULL AND EXISTS (SELECT 1 FROM a WHERE $1::text::inet <<= a."IpOrCidr"::inet))) AS ok`, [ip])
    return r[0]!
  }
}

export class SessionAdminRepository {
  constructor(private q: Queryable) {}
  async end(publicId: string, endedBy: number) {
    const s = (await this.q.query<{ Id: number; UserId: number }>(
      `UPDATE sys_user_session SET "EndedAt"=now(),"EndReason"='REVOKED_BY_ADMIN',"EndedBy"=$2 WHERE "PublicId"=$1 AND "EndedAt" IS NULL RETURNING "Id","UserId"`, [publicId, endedBy]))[0]
    if (s) await this.q.query(`UPDATE sys_refresh_token SET "RevokedAt"=now() WHERE "SessionId"=$1 AND "RevokedAt" IS NULL`, [s.Id])
    return s
  }
}
