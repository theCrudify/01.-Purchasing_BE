import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { requireCronSecret } from '../../middleware/cron'
import { exchangeRateController as ctl } from './exchange-rate.controller'
import { rateCreate, rateKey, rateListQuery } from './exchange-rate.schema'

export const exchangeRateRoutes = new Hono<AppEnv>()
  .post('/cron/import', requireCronSecret, (c) => ctl.cronImport(c)) // scheduler (no user session)
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', validate('query', rateListQuery), (c) => ctl.list(c, c.req.valid('query')))
  .post('/import', requirePermission('FX.MANAGE'), (c) => ctl.importLatest(c))
  .get('/:key', validate('param', rateKey), (c) => ctl.get(c, c.req.valid('param').key))
  .post('/', requirePermission('FX.MANAGE'), validate('json', rateCreate), (c) => ctl.create(c, c.req.valid('json')))
  .delete('/:key', requirePermission('FX.MANAGE'), validate('param', rateKey), (c) => ctl.remove(c, c.req.valid('param').key))
