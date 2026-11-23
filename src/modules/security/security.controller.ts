import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { crudController } from '../../core/crud'
import { IpAllowListService, SessionAdminService } from './security.service'
import { clientIp } from './security.middleware'

const ipSvc = (c: Context<AppEnv>) => new IpAllowListService(c.get('db'), c.get('actor'), clientIp(c))
export const ipAllowListController = {
  ...crudController(ipSvc),
  check: async (c: Context<AppEnv>) => c.json({ data: await ipSvc(c).check() }),
}
export const sessionAdminController = {
  revoke: async (c: Context<AppEnv>, id: string) => c.json({ data: await new SessionAdminService(c.get('db'), c.get('actor')).revoke(id) }),
}
