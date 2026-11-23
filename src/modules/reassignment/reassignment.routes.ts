import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requireUserType } from '../../middleware/auth'
import { reassignmentController as ctl } from './reassignment.controller'
import { reassignmentCreate, reassignmentDecide, reassignmentListQuery, reassignmentParam } from './reassignment.schema'

export const reassignmentRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', validate('query', reassignmentListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .post('/', validate('json', reassignmentCreate), (c) => ctl.create(c, c.req.valid('json')))
  .post('/:id/decide', validate('param', reassignmentParam), validate('json', reassignmentDecide), (c) => ctl.decide(c, c.req.valid('param').id, c.req.valid('json')))
