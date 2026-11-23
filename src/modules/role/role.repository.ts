import type { Queryable } from '../../core/db'
import { CrudRepository } from '../../core/crud'
import { roleDef } from './role.schema'

/** SQL only. */
export class RoleRepository extends CrudRepository {
  constructor(q: Queryable) { super(q, roleDef) }

  async assignedUsers(id: number) {
    return (await this.q.query<{ n: number }>(`SELECT count(*)::int n FROM mst_user_role WHERE "RoleId"=$1`, [id]))[0]!.n
  }
  permissionIds(id: number) {
    return this.q.query<{ id: number; code: string }>(
      `SELECT p."Id" AS id, p."Code" AS code FROM mst_role_permission rp JOIN mst_permission p ON p."Id"=rp."PermissionId" WHERE rp."RoleId"=$1 ORDER BY p."Code"`, [id])
  }
  async countPermissions(ids: number[]) {
    return (await this.q.query<{ n: number }>(`SELECT count(*)::int n FROM mst_permission WHERE "Id"=ANY($1::int[])`, [ids]))[0]!.n
  }
  async replacePermissions(id: number, ids: number[], actorId: number) {
    await this.q.query(`DELETE FROM mst_role_permission WHERE "RoleId"=$1 AND NOT ("PermissionId"=ANY($2::int[]))`, [id, ids])
    await this.q.query(`INSERT INTO mst_role_permission ("RoleId","PermissionId","CreatedBy") SELECT $1, x, $3 FROM unnest($2::int[]) x ON CONFLICT DO NOTHING`, [id, ids, actorId])
  }
}
