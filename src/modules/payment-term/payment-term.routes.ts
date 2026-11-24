import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { crudListQuery, crudRoutes } from '../../core/crud'
import { validate } from '../../core/validate'
import { requireAuth } from '../../middleware/auth'
import { paymentTermController } from './payment-term.controller'
import { paymentTermCreate, paymentTermDef } from './payment-term.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes).
 *  The list alone is open to every signed-in user (vendors pick a term on their quotation); writes stay INTERNAL. */
export const paymentTermRoutes = new Hono<AppEnv>()
  .get('/', requireAuth, validate('query', crudListQuery(paymentTermDef)), (c) => paymentTermController.list(c, c.req.valid('query')))
  .route('/', crudRoutes(paymentTermDef, paymentTermController, { create: paymentTermCreate }))
