import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth } from '../../middleware/auth'
import { notificationController as ctl } from './notification.controller'
import { notificationListQuery, notificationParam } from './notification.schema'

/** Own notifications only (internal and portal users). */
export const notificationRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', validate('query', notificationListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .get('/unread-count', (c) => ctl.unread(c))
  .post('/read-all', (c) => ctl.readAll(c))
  .post('/:id/read', validate('param', notificationParam), (c) => ctl.read(c, c.req.valid('param').id))
