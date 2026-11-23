import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { requireAuth, requireUserType } from '../../middleware/auth'
import { dashboardController as ctl } from './dashboard.controller'

export const dashboardRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', requireUserType('INTERNAL'), (c) => ctl.internal(c))
  .get('/portal', requireUserType('BP'), (c) => ctl.portal(c))
