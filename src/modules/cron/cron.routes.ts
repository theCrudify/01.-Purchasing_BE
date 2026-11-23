import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { requireCronSecret } from '../../middleware/cron'
import { cronController as ctl } from './cron.controller'

/** Scheduler only (x-cron-secret or Vercel's Authorization: Bearer CRON_SECRET). GET for Vercel Cron, POST for manual runs. */
export const cronRoutes = new Hono<AppEnv>()
  .use(requireCronSecret)
  .on(['GET', 'POST'], '/daily', (c) => ctl.daily(c))
  .on(['GET', 'POST'], '/dispatch', (c) => ctl.dispatch(c))
  .on(['GET', 'POST'], '/cleanup', (c) => ctl.cleanup(c))
