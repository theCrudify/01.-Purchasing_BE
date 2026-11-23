import type { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { ctrRoutes, grRoutes, poRoutes, prRoutes, quoRoutes, rfqRoutes } from '../procurement/procurement.routes'

/** Routes owned by the "procurement" group: [mount path under /api, router]. */
export const routes: [string, Hono<AppEnv, any, any>][] = [
  ['/pr', prRoutes],
  ['/rfq', rfqRoutes],
  ['/quotations', quoRoutes],
  ['/contracts', ctrRoutes],
  ['/po', poRoutes],
  ['/gr', grRoutes],
]
