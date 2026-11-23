import { crudRoutes } from '../../core/crud'
import { taxCodeController } from './tax-code.controller'
import { taxCodeCreate, taxCodeDef } from './tax-code.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const taxCodeRoutes = crudRoutes(taxCodeDef, taxCodeController, { create: taxCodeCreate })
