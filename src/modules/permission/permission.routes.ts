import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { ipAllowList } from '../security/security.middleware'
import { permissionController as ctl } from './permission.controller'
import { permissionListQuery } from './permission.schema'

export const permissionRoutes = new Hono<AppEnv>()
  .use(ipAllowList, requireAuth, requireUserType('INTERNAL'), requirePermission('USER.VIEW', 'ROLE.MANAGE'))
  .get('/', validate('query', permissionListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .get('/grouped', (c) => ctl.grouped(c))
