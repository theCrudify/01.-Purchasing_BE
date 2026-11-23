import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { crudController } from '../../core/crud'
import { RoleService } from './role.service'

const svc = (c: Context<AppEnv>) => new RoleService(c.get('db'), c.get('actor'))
export const roleController = {
  ...crudController(svc),
  permissions: async (c: Context<AppEnv>, id: number) => c.json({ data: await svc(c).permissions(id) }),
  setPermissions: async (c: Context<AppEnv>, id: number, ids: number[]) => c.json({ data: await svc(c).setPermissions(id, ids) }),
}
