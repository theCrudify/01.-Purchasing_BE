import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { HttpError, conflict } from '../../core/errors'
import { RoleRepository } from './role.repository'
import { roleDef } from './role.schema'

/** Roles + role↔permission matrix. */
export class RoleService extends CrudService<RoleRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new RoleRepository(q), roleDef, {
      async beforeDelete(repo, key) {
        const n = await repo.assignedUsers(key as number)
        if (n > 0) throw conflict(`Role is still assigned to ${n} user(s); remove it from them first`)
      },
    })
  }
  permissions(id: number) { return this.run(async (r) => { this.found(await r.get(id)); return r.permissionIds(id) }) }
  setPermissions(id: number, permissionIds: number[]) {
    const ids = [...new Set(permissionIds)]
    return this.run(async (r) => {
      const role = this.found((await r.get(id)) as { isDeleted: boolean } | undefined)
      if (role.isDeleted) throw conflict('Role is deleted')
      if ((await r.countPermissions(ids)) !== ids.length) throw new HttpError(422, 'INVALID_PERMISSION', 'Unknown permission id')
      await r.replacePermissions(id, ids, this.actor.id)
      return r.permissionIds(id)
    })
  }
}
