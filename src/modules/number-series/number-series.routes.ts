import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { crudListQuery } from '../../core/crud'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { numberSeriesController as ctl } from './number-series.controller'
import { numberSeriesDef, numberSeriesKey, numberSeriesUpdate } from './number-series.schema'

export const numberSeriesRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'), requirePermission('SYS.NUMBER_SERIES_MANAGE'))
  .get('/', validate('query', crudListQuery(numberSeriesDef)), (c) => ctl.list(c, c.req.valid('query')))
  .get('/:key', validate('param', numberSeriesKey), (c) => ctl.get(c, c.req.valid('param').key))
  .patch('/:key', validate('param', numberSeriesKey), validate('json', numberSeriesUpdate), (c) => ctl.update(c, c.req.valid('param').key, c.req.valid('json')))
