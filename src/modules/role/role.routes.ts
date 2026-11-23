import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { crudRoutes } from '../../core/crud'
import { validate } from '../../core/validate'
import { requirePermission } from '../../middleware/auth'
import { ipAllowList } from '../security/security.middleware'
import { roleController as ctl } from './role.controller'
import { roleCreate, roleDef, roleKey, rolePermissions, roleUpdate } from './role.schema'

const crud = crudRoutes(roleDef, ctl, { create: roleCreate, update: roleUpdate }, { view: 'USER.VIEW', manage: 'ROLE.MANAGE', delete: 'ROLE.MANAGE' })
  .get('/:key/permissions', requirePermission('USER.VIEW', 'ROLE.MANAGE'), validate('param', roleKey), (c) => ctl.permissions(c, c.req.valid('param').key))
  .put('/:key/permissions', requirePermission('ROLE.MANAGE'), validate('param', roleKey), validate('json', rolePermissions),
    (c) => ctl.setPermissions(c, c.req.valid('param').key, c.req.valid('json').permissionIds))

export const roleRoutes = new Hono<AppEnv>().use(ipAllowList).route('/', crud)
