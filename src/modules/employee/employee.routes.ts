import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { employeeController as ctl } from './employee.controller'
import { employeeCreate, employeeKey, employeeListQuery, employeeUpdate } from './employee.schema'

/** No delete: employees leave via EndDate / IsActive (and the handover flow). */
export const employeeRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', requirePermission('MASTER.VIEW', 'USER.VIEW'), validate('query', employeeListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .get('/:id', requirePermission('MASTER.VIEW', 'USER.VIEW'), validate('param', employeeKey), (c) => ctl.get(c, c.req.valid('param').id))
  .post('/', requirePermission('USER.MANAGE'), validate('json', employeeCreate), (c) => ctl.create(c, c.req.valid('json')))
  .patch('/:id', requirePermission('USER.MANAGE'), validate('param', employeeKey), validate('json', employeeUpdate), (c) => ctl.update(c, c.req.valid('param').id, c.req.valid('json')))
