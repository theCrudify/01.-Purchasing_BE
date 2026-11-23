import type { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { bpRoutes, svrRoutes } from '../bp/bp.routes'

/** Routes owned by the "bp" group: [mount path under /api, router]. */
export const routes: [string, Hono<AppEnv, any, any>][] = [
  ['/vendors', bpRoutes],
  ['/verifications', svrRoutes],
]
