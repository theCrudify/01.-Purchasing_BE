import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../env'
import { crudRoutes } from '../../core/crud'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { ipAllowListController as ipc, sessionAdminController } from './security.controller'
import { ipAllowList } from './security.middleware'
import { ipAllowListDef, ipCreate, sessionParam } from './security.schema'

const PERMS = { view: 'SECURITY.MANAGE', manage: 'SECURITY.MANAGE' }
const ipRoutes = crudRoutes(ipAllowListDef, ipc, { create: ipCreate }, PERMS)
  .get('/check/me', requirePermission('SECURITY.MANAGE'), (c) => ipc.check(c))
  .delete('/:key', requirePermission('SECURITY.MANAGE'), validate('param', z.object({ key: z.coerce.number().int().positive() })), (c) => ipc.remove(c, c.req.valid('param').key))

export const securityRoutes = new Hono<AppEnv>()
  .use(ipAllowList)
  .route('/ip-allow-list', ipRoutes)
  .post('/sessions/:id/revoke', requireAuth, requireUserType('INTERNAL'), requirePermission('SECURITY.MANAGE'), validate('param', sessionParam),
    (c) => sessionAdminController.revoke(c, c.req.valid('param').id))
