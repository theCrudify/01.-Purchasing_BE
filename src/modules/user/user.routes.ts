import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { ipAllowList } from '../security/security.middleware'
import { userController as ctl } from './user.controller'
import { idParam, sessionListQuery, userCreate, userDisable, userListQuery, userLookupQuery, userRoles, userUpdate } from './user.schema'

const VIEW = requirePermission('USER.VIEW'), MANAGE = requirePermission('USER.MANAGE')
const id = validate('param', idParam)

/** Admin user management (internal staff only, behind the optional IP allow list). */
export const userRoutes = new Hono<AppEnv>()
  .use(ipAllowList, requireAuth, requireUserType('INTERNAL'))
  .get('/', VIEW, validate('query', userListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .post('/', MANAGE, validate('json', userCreate), (c) => ctl.create(c, c.req.valid('json')))
  .get('/:id', VIEW, id, (c) => ctl.get(c, c.req.valid('param').id))
  .patch('/:id', MANAGE, id, validate('json', userUpdate), (c) => ctl.update(c, c.req.valid('param').id, c.req.valid('json')))
  .put('/:id/roles', MANAGE, id, validate('json', userRoles), (c) => ctl.setRoles(c, c.req.valid('param').id, c.req.valid('json').roleIds))
  .post('/:id/disable', MANAGE, id, validate('json', userDisable), (c) => ctl.disable(c, c.req.valid('param').id, c.req.valid('json').reason))
  .post('/:id/enable', MANAGE, id, (c) => ctl.enable(c, c.req.valid('param').id))
  .post('/:id/unlock', MANAGE, id, (c) => ctl.unlock(c, c.req.valid('param').id))
  .post('/:id/send-reset', MANAGE, id, (c) => ctl.sendReset(c, c.req.valid('param').id))
  .post('/:id/force-logout', requirePermission('SECURITY.MANAGE', 'USER.MANAGE'), id, (c) => ctl.forceLogout(c, c.req.valid('param').id))
  .get('/:id/sessions', VIEW, id, validate('query', sessionListQuery), (c) => ctl.sessions(c, c.req.valid('param').id, c.req.valid('query')))

/** Name lookup for pickers: any signed-in internal user (display names are not secret). */
export const userLookupRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', validate('query', userLookupQuery), (c) => ctl.lookup(c, c.req.valid('query')))
  .get('/:id', id, (c) => ctl.lookupOne(c, c.req.valid('param').id))
