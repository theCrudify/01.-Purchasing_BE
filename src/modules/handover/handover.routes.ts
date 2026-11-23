import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { handoverController as ctl } from './handover.controller'
import { handoverCreate, handoverListQuery, handoverParam } from './handover.schema'

export const handoverRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'), requirePermission('HANDOVER.MANAGE'))
  .get('/', validate('query', handoverListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .get('/:id', validate('param', handoverParam), (c) => ctl.get(c, c.req.valid('param').id))
  .post('/', validate('json', handoverCreate), (c) => ctl.execute(c, c.req.valid('json')))
