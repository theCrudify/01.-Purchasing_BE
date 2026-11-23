import { crudRoutes } from '../../core/crud'
import { paymentTermController } from './payment-term.controller'
import { paymentTermCreate, paymentTermDef } from './payment-term.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const paymentTermRoutes = crudRoutes(paymentTermDef, paymentTermController, { create: paymentTermCreate })
