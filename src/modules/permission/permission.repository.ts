import type { Queryable } from '../../core/db'
import { runList, type ListQuery } from '../../core/list-query'
import { permissionList } from './permission.schema'

/** SQL only. Permissions are seeded by migrations: read-only here. */
export class PermissionRepository {
  constructor(private q: Queryable) {}
  list(qs: ListQuery & { module?: string }) {
    const where: string[] = [], params: unknown[] = []
    if (qs.module) { params.push(qs.module); where.push(`t."Module" = $1`) }
    return runList(this.q, permissionList, qs, { where, params })
  }
  grouped() {
    return this.q.query<{ module: string; permissions: { id: number; code: string; name: string }[] }>(
      `SELECT "Module" AS module, json_agg(json_build_object('id',"Id",'code',"Code",'name',"Name") ORDER BY "Code") AS permissions
         FROM mst_permission GROUP BY "Module" ORDER BY "Module"`)
  }
}
