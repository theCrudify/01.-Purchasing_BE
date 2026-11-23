import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requireUserType } from '../../middleware/auth'
import { bpController as ctl } from './bp.controller'
import { bpCreate, bpListQuery, bpUpdate, svrCreate, svrListQuery, uuidParam } from './bp.schema'

export const bpRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', validate('query', bpListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .get('/:id', validate('param', uuidParam), (c) => ctl.get(c, c.req.valid('param').id))
  .post('/', validate('json', bpCreate), (c) => ctl.create(c, c.req.valid('json')))
  .patch('/:id', validate('param', uuidParam), validate('json', bpUpdate), (c) =>
    ctl.update(c, c.req.valid('param').id, c.req.valid('json'))
  )

export const svrRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', validate('query', svrListQuery), (c) => ctl.listSvr(c, c.req.valid('query')))
  .post('/', validate('json', svrCreate), (c) => ctl.createSvr(c, c.req.valid('json')))
  .post('/:id/submit', validate('param', uuidParam), (c) => ctl.submitSvr(c, c.req.valid('param').id))
