import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { crudListQuery } from '../../core/crud'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { currencyController as ctl } from './currency.controller'
import { currencyDef, currencyKey, currencyUpdate } from './currency.schema'

/** No create/delete: the ISO list is seeded. Any logged-in user may read (documents pick currencies). */
export const currencyRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', validate('query', crudListQuery(currencyDef)), (c) => ctl.list(c, c.req.valid('query')))
  .get('/:key', validate('param', currencyKey), (c) => ctl.get(c, c.req.valid('param').key))
  .patch('/:key', requireUserType('INTERNAL'), requirePermission('FX.MANAGE'), validate('param', currencyKey), validate('json', currencyUpdate), (c) => ctl.update(c, c.req.valid('param').key, c.req.valid('json')))
