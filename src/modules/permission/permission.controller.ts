import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { PermissionService } from './permission.service'

const svc = (c: Context<AppEnv>) => new PermissionService(c.get('db'), c.get('actor'))
export const permissionController = {
  list: async (c: Context<AppEnv>, qs: any) => c.json(await svc(c).list(qs)),
  grouped: async (c: Context<AppEnv>) => c.json({ data: await svc(c).grouped() }),
}
